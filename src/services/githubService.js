import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

class GitHubService {
    constructor() {
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });
        this.repoOwner = process.env.GITHUB_REPO_OWNER;
        this.repoName = process.env.GITHUB_REPO_NAME;
        this.localRepoPath = process.env.GITHUB_LOCAL_REPO_PATH;
    }

    getTempRepoPath(dirName = '') {
        const tempDir = path.join(os.tmpdir(), `gh-lfs-tmp-${uuidv4()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        const repoUrl = `https://github.com/${this.repoOwner}/${this.repoName}.git`;
        execSync(`git clone --depth 1 --filter=blob:none --sparse "${repoUrl}" "${tempDir}"`);
        if (dirName) {
            execSync(`git sparse-checkout set "${dirName}"`, { cwd: tempDir });
        }
        return tempDir;
    }

    cleanupTempRepoPath(tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // 여러 파일을 한 번에 동기화 (커밋 하나로, LFS 포함)
    async syncFiles(files, commitMessage) {
        // files: [{ filePath, fileName, size, dirName, ... }]
        // uploads/ 경로는 서버 임시 저장용이므로, github에는 uploads/를 제외한 경로로 업로드해야 함
        const dir = files.length > 0 ? (files[0].dirName || '') : '';
        const hasLfs = files.some(f => f.size > 100 * 1024 * 1024);

        // 메타데이터 파일 생성
        const meta = {
            files: files.map(f => ({
                fileName: f.fileName,
                size: f.size,
                uploadedAt: new Date().toISOString(),
                action: f.action || 'upload',
            })),
            commitMessage,
            updatedAt: new Date().toISOString(),
        };
        const metaFileName = 'meta.json';
        const metaFilePath = path.join(
            files.length > 0 ? path.dirname(files[0].filePath) : '',
            metaFileName
        );
        fs.writeFileSync(metaFilePath, JSON.stringify(meta, null, 2));

        // 메타데이터도 files에 추가
        const filesWithMeta = [
            ...files,
            {
                filePath: metaFilePath,
                fileName: metaFileName,
                size: Buffer.byteLength(JSON.stringify(meta)),
                dirName: dir,
            },
        ];

        if (hasLfs) {
            const tempRepo = this.getTempRepoPath(dir);
            try {
                for (const file of filesWithMeta) {
                    // uploads/ 경로를 github에는 포함하지 않음
                    const destPath = path.join(tempRepo, dir, file.fileName);
                    fs.mkdirSync(path.dirname(destPath), { recursive: true });
                    fs.copyFileSync(file.filePath, destPath);
                    if (file.size > 100 * 1024 * 1024) {
                        execSync(`git lfs track "${path.join(dir, file.fileName)}"`, { cwd: tempRepo });
                    }
                }
                execSync(
                    `git add .gitattributes ${filesWithMeta.map(f => `"${path.join(dir, f.fileName)}"`).join(' ')}`,
                    { cwd: tempRepo }
                );
                execSync(`git commit -m "${commitMessage}"`, { cwd: tempRepo });

                // git push with conflict retry
                let pushed = false, retry = 0;
                while (!pushed && retry < 2) {
                    try {
                        execSync(`git push origin main`, { cwd: tempRepo });
                        pushed = true;
                    } catch (e) {
                        execSync(`git pull --rebase origin main`, { cwd: tempRepo });
                        retry++;
                    }
                }
                if (!pushed) throw new Error('git push failed after retry');
                return [{ dir, message: 'Batch synced via git (LFS if large)', meta: metaFileName }];
            } finally {
                this.cleanupTempRepoPath(tempRepo);
            }
        } else {
            for (const file of filesWithMeta) {
                // uploads/ 경로를 github에는 포함하지 않음
                await this.uploadOrUpdateWithConflictRetry({
                    filePath: file.filePath,
                    fileName: file.fileName,
                    commitMessage,
                    dir
                });
            }
            return [{ dir, message: 'Batch synced via GitHub API', meta: metaFileName }];
        }
    }

    async getFile(fileName) {
        const response = await this.octokit.repos.getContent({
            owner: this.repoOwner,
            repo: this.repoName,
            path: fileName,
        });
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
    }

    async deleteFile(fileName, commitMessage) {
        const { data: { sha } } = await this.octokit.repos.getContent({
            owner: this.repoOwner,
            repo: this.repoName,
            path: fileName,
        });
        const response = await this.octokit.repos.deleteFile({
            owner: this.repoOwner,
            repo: this.repoName,
            path: fileName,
            message: commitMessage,
            sha: sha,
        });
        return response.data;
    }

    async uploadOrUpdateWithConflictRetry({ filePath, fileName, commitMessage, dir }) {
        const maxRetry = 2;
        let retry = 0;
        while (retry < maxRetry) {
            let sha = undefined;
            try {
                const { data } = await this.octokit.repos.getContent({
                    owner: this.repoOwner,
                    repo: this.repoName,
                    path: path.join(dir, fileName),
                });
                sha = data.sha;
            } catch (err) {
                if (err.status !== 404) throw err;
            }
            const content = fs.readFileSync(filePath, { encoding: 'base64' });
            try {
                await this.octokit.repos.createOrUpdateFileContents({
                    owner: this.repoOwner,
                    repo: this.repoName,
                    path: path.join(dir, fileName),
                    message: commitMessage,
                    content: content,
                    sha: sha,
                    committer: {
                        name: 'File Uploader',
                        email: 'uploader@example.com',
                    },
                    author: {
                        name: 'File Uploader',
                        email: 'uploader@example.com',
                    },
                });
                return { file: fileName, status: 'success' };
            } catch (err) {
                if (err.status === 409) {
                    retry++;
                    continue;
                }
                throw err;
            }
        }
        throw new Error('Conflict: Could not update file after retry');
    }
}

export default new GitHubService();
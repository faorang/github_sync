class FilesController {
    constructor(githubService) {
        this.githubService = githubService;
    }

    async uploadFile(req, res) {
        try {
            const file = req.file;
            const userId = req.user.id;
            const dirName = req.body.dir_name || '';
            const filePath = file.path;

            await this.githubService.syncFiles(
                [{
                    filePath,
                    fileName: file.originalname,
                    size: file.size,
                    dirName,
                    action: 'upload'
                }],
                `Upload by ${userId}`
            );

            res.status(200).json({ message: 'File uploaded and synchronized successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'Error uploading file.', error: error.message });
        }
    }

    async modifyFile(req, res) {
        try {
            const file = req.file;
            const userId = req.user.id;
            const dirName = req.body.dir_name || '';
            const filePath = file.path;

            await this.githubService.syncFiles(
                [{
                    filePath,
                    fileName: file.originalname,
                    size: file.size,
                    dirName,
                    action: 'modify'
                }],
                `Modify by ${userId}`
            );

            res.status(200).json({ message: 'File modified and synchronized successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'Error modifying file.', error: error.message });
        }
    }

    async deleteFile(req, res) {
        try {
            const fileName = req.params.filename;
            const commitMessage = req.body.commitMessage || 'Delete file';
            await this.githubService.deleteFile(fileName, commitMessage);
            res.status(200).json({ message: 'File deleted successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'Error deleting file.', error: error.message });
        }
    }

    async syncFile(req, res) {
        try {
            const { filePath, fileName, commitMessage } = req.body;
            await this.githubService.syncFile(filePath, fileName, commitMessage || 'Sync file');
            res.status(200).json({ message: 'File synchronized successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'Error synchronizing file.', error: error.message });
        }
    }

    async retrieveFile(req, res) {
        try {
            const fileName = req.params.filename;
            const content = await this.githubService.getFile(fileName);
            res.status(200).send(content);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving file.', error: error.message });
        }
    }

    async listFiles(req, res) {
        try {
            const files = await this.githubService.listFiles();
            res.status(200).json({ files });
        } catch (error) {
            res.status(500).json({ message: 'Error listing files.', error: error.message });
        }
    }

    async uploadFiles(req, res) {
        try {
            const files = req.files;
            const userId = req.user.id;
            const dirName = req.body.dir_name || '';
            const commitMessage = req.body.commitMessage || `Batch upload by ${userId}`;
            const savedFiles = [];

            for (const file of files) {
                savedFiles.push({
                    filePath: file.path,
                    fileName: file.originalname,
                    size: file.size,
                    dirName,
                    action: 'upload'
                });
            }

            await this.githubService.syncFiles(savedFiles, commitMessage);

            res.status(200).json({ message: 'Files uploaded and synchronized in a single commit.' });
        } catch (error) {
            res.status(500).json({ message: 'Error uploading files.', error: error.message });
        }
    }

    async modifyFiles(req, res) {
        try {
            const files = req.files;
            const userId = req.user.id;
            const dirName = req.body.dir_name || '';
            const commitMessage = req.body.commitMessage || `Batch modify by ${userId}`;
            const savedFiles = [];

            for (const file of files) {
                savedFiles.push({
                    filePath: file.path,
                    fileName: file.originalname,
                    size: file.size,
                    dirName,
                    action: 'modify'
                });
            }

            await this.githubService.syncFiles(savedFiles, commitMessage);

            res.status(200).json({ message: 'Files modified and synchronized successfully.' });
        } catch (error) {
            res.status(500).json({ message: 'Error modifying files.', error: error.message });
        }
    }

    async syncFiles(req, res) {
        try {
            const files = req.body.files; // [{filePath, fileName, commitMessage}]
            const syncTasks = files.map(({ filePath, fileName, commitMessage }) =>
                this.githubService.syncFile(filePath, fileName, commitMessage || 'Sync file')
                    .then(() => ({ file: fileName, status: 'synced' }))
            );
            const results = await Promise.all(syncTasks);
            res.status(200).json({ message: 'Files synchronized successfully.', results });
        } catch (error) {
            res.status(500).json({ message: 'Error synchronizing files.', error: error.message });
        }
    }

    async saveFile(filePath, buffer) {
        // multer가 파일을 저장하므로 이 메서드는 더 이상 필요 없음
    }
}

module.exports = FilesController;
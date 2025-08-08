const fs = require('fs');
const path = require('path');

// Function to resolve conflicts when multiple users attempt to modify the same file
const resolveConflict = (filePath, newContent) => {
    const currentContent = fs.readFileSync(filePath, 'utf-8');
    
    // Simple conflict resolution strategy: append new content with a timestamp
    const timestamp = new Date().toISOString();
    const resolvedContent = `${currentContent}\n\n// Conflict resolved on ${timestamp}\n${newContent}`;
    
    fs.writeFileSync(filePath, resolvedContent, 'utf-8');
};

// Function to check if a file is modified by another user
const isFileModified = (filePath, lastModifiedTime) => {
    const stats = fs.statSync(filePath);
    return stats.mtime > lastModifiedTime;
};

module.exports = {
    resolveConflict,
    isFileModified,
};
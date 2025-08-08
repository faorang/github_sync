const express = require('express');
const router = express.Router();
const FilesController = require('../controllers/filesController');

const filesController = new FilesController();

// Route for uploading a file
router.post('/upload', filesController.uploadFile.bind(filesController));

// Route for modifying a file
router.put('/modify/:filename', filesController.modifyFile.bind(filesController));

// Route for retrieving a file
router.get('/retrieve/:filename', filesController.retrieveFile.bind(filesController));

// Route for listing all files
router.get('/list', filesController.listFiles.bind(filesController));

// Route for deleting a file
router.delete('/delete/:filename', filesController.deleteFile.bind(filesController));

// Route for syncing a file
router.post('/sync', filesController.syncFile.bind(filesController));

module.exports = router;
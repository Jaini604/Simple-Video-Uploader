const express = require('express');
const fs = require('fs');
const path = require('path');
const { uploadChunk, mergeChunks } = require('../controllers/uploadcontroller');
const { convertMovToMp4 } = require('../controllers/conversioncontroller');
const { streamVideo } = require('../controllers/videocontroller');

const router = express.Router();

// Upload video chunk
router.post('/chunk', uploadChunk);

// Merge video chunks into a single file and then convert MOV to MP4
router.post('/merge', async (req, res) => {
    try {
        const { filename, totalChunks } = req.body;

        if (!filename || !totalChunks) {
            return res.status(400).json({ error: 'Missing filename or totalChunks in the request' });
        }

        // Step 1: Merge the chunks
        await mergeChunks(filename);

        // Step 2: After chunks are merged, convert MOV to MP4
        const outputFilename = filename.replace('.mov', '.mp4'); // Generate the output MP4 filename
        await convertMovToMp4(filename, outputFilename);

        res.status(200).json({ message: 'File merged and converted to MP4 successfully', filePath: `/uploads/${outputFilename}` });

    } catch (error) {
        console.error('Error during merge and conversion:', error);
        res.status(500).json({ error: 'Error merging chunks and converting file', details: error.message });
    }
});

// Route for MOV to MP4 conversion
router.post('/convert', convertMovToMp4);

// Video playback route (Streaming)
router.get('/play/:filename', streamVideo);

module.exports = router;

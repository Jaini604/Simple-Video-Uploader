const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mergeChunksUtil = require('../utils/mergeChunks');

// Multer configuration for chunk uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tempDir = path.join(__dirname, '..', 'temp');
        // Ensure the temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true }); // Create directory if it doesn't exist
        }
        cb(null, tempDir); // Store chunks in the 'temp' directory
    },
    filename: (req, file, cb) => {
        if (!req.body.chunkNumber) {
            return cb(new Error('Missing chunkNumber in the request'));
        }
        // Use chunk number and file extension to name files
        cb(null, `chunk-${req.body.chunkNumber}${path.extname(file.originalname)}`);
    },
});

const upload = multer({ storage });

// Upload video chunk
const uploadChunk = (req, res) => {
    upload.single('chunk')(req, res, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Error uploading chunk', details: err.message });
        }

        const { chunkNumber, totalChunks } = req.body;

        if (!chunkNumber || !totalChunks) {
            return res.status(400).json({ error: 'Missing chunkNumber or totalChunks in the request' });
        }

        console.log(`Received chunk ${chunkNumber} of ${totalChunks}`);
        res.status(200).json({ message: `Chunk ${chunkNumber} uploaded successfully` });
    });
};

// Merge video chunks
const mergeChunks = async (req, res) => {
    const { filename } = req.body;

    if (!filename) {
        return res.status(400).json({ error: 'Missing filename in the request' });
    }

    const chunkDir = path.join(__dirname, '..', 'temp'); // Directory for chunk storage
    const outputPath = path.join(__dirname, '..', 'uploads', filename);

    try {
        // Ensure the output directory exists
        if (!fs.existsSync(path.dirname(outputPath))) {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        }

        // Merge the chunks using the utility function
        await mergeChunksUtil(chunkDir, outputPath);

        // Clean up temporary chunk files after merging
        const chunkFiles = await fs.promises.readdir(chunkDir);
        await Promise.all(chunkFiles.map((file) => {
            // Only delete chunk files, avoid accidental deletions
            if (file.startsWith('chunk-')) {
                return fs.promises.unlink(path.join(chunkDir, file));
            }
        }));

        res.status(200).json({
            message: 'Chunks merged successfully',
            filePath: `/uploads/${filename}`,
        });
    } catch (error) {
        console.error('Error merging chunks:', error);
        res.status(500).json({ error: 'Error merging chunks', details: error.message });
    }
};

module.exports = { uploadChunk, mergeChunks };

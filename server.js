const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static'); // Ensure FFmpeg binary is available
const favicon = require('serve-favicon');
const app = express();
const PORT = 4000;

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.use(favicon(path.join(__dirname, 'public', 'favicon.png')));
// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Multer configuration for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'temp/'); // Store uploaded chunks in the temp folder
    },
    filename: (req, file, cb) => {
        const fileName = req.body.fileName || Date.now(); // Use original file name from request
        cb(null, fileName + '-' + req.body.chunkNumber + path.extname(file.originalname)); // Append chunk number to avoid name collisions
    }
});

const upload = multer({ storage });

// In-memory storage for chunked uploads
const chunkedUploads = {}; // Store the chunked uploads

// Route to handle chunked file upload and merge the chunks
app.post('/api/upload/chunk', upload.single('chunk'), (req, res) => {
    const { chunkNumber, totalChunks, fileName } = req.body;

    if (!fileName) {
        return res.status(400).json({ error: 'File name is missing from the request' });
    }

    const chunkFilePath = req.file?.path;

    if (!chunkFilePath) {
        return res.status(400).json({ error: 'Chunk file path is missing' });
    }

    console.log('Received chunk:', { chunkNumber, totalChunks, fileName, chunkFilePath });

    // Create a folder for each upload if not present
    if (!chunkedUploads[fileName]) {
        chunkedUploads[fileName] = {
            totalChunks: parseInt(totalChunks),
            uploadedChunks: new Array(parseInt(totalChunks)), // Array to store chunk paths
        };
    }

    // Save the chunk in memory (this can be saved to disk if needed)
    chunkedUploads[fileName].uploadedChunks[chunkNumber] = chunkFilePath;

    // Check if all chunks are uploaded
    const uploadedChunksCount = chunkedUploads[fileName].uploadedChunks.filter(Boolean).length;
    if (uploadedChunksCount === chunkedUploads[fileName].totalChunks) {
        // All chunks uploaded, now combine them into a final file
        const outputFilePath = path.join(__dirname, 'uploads', fileName);
        const writeStream = fs.createWriteStream(outputFilePath);

        // Merge the chunks asynchronously
        const mergeChunksAsync = async () => {
            try {
                const chunkPaths = chunkedUploads[fileName].uploadedChunks;
                for (let i = 0; i < chunkPaths.length; i++) {
                    const chunkPath = chunkPaths[i];
                    const chunkStream = fs.createReadStream(chunkPath);

                    // Wait for each chunk to finish before proceeding
                    await new Promise((resolve, reject) => {
                        chunkStream.pipe(writeStream, { end: false });

                        chunkStream.on('end', resolve);
                        chunkStream.on('error', reject);
                    });

                    // Clean up the chunk after processing
                    await fs.promises.unlink(chunkPath);
                    console.log(`Processed and deleted chunk: ${chunkPath}`);
                }

                writeStream.end();

                writeStream.on('finish', async () => {
                    console.log('All chunks merged successfully.');

                    // After merging, check if it's MOV and convert to MP4 if needed
                    const outputExtension = path.extname(fileName).toLowerCase();
                    if (outputExtension === '.mov') {
                        const mp4FilePath = path.join(__dirname, 'uploads', fileName.replace('.mov', '.mp4'));

                        try {
                            // Convert MOV to MP4
                            await convertMovToMp4(outputFilePath, mp4FilePath);

                            // Send the MP4 file path as a response
                            res.json({ filePath: `/uploads/${path.basename(mp4FilePath)}` });
                        } catch (err) {
                            console.error('Error converting MOV to MP4:', err);
                            res.status(500).json({ error: 'Error converting MOV to MP4', details: err.message });
                        }
                    } else {
                        // If not MOV, just send the original file path
                        res.json({ filePath: `/uploads/${fileName}` });
                    }

                    // Clean up the chunk info from memory
                    delete chunkedUploads[fileName];
                });
            } catch (error) {
                console.error('Error merging chunks:', error);
                res.status(500).json({ error: 'Error merging chunks', details: error.message });
            }
        };

        mergeChunksAsync();
    } else {
        res.json({ message: `Chunk ${chunkNumber + 1} uploaded, waiting for other chunks...` });
    }
});

// Function to convert MOV to MP4 using FFmpeg
const convertMovToMp4 = (inputFilePath, outputFilePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputFilePath)
            .output(outputFilePath)
            .on('end', () => {
                console.log(`Conversion successful: ${inputFilePath} to ${outputFilePath}`);
                resolve();
            })
            .on('error', (err) => {
                console.error(`Error during conversion: ${err.message}`);
                reject(err);
            })
            .run();
    });
};

// Route to finalize the upload (after all chunks are uploaded and merged)
app.post('/api/upload/complete', (req, res) => {
    const { fileName } = req.body;

    if (!fileName) {
        return res.status(400).json({ error: 'File name is missing from the request' });
    }

    // Check if the final file exists after chunk merging
    const filePath = path.join(__dirname, 'uploads', fileName);
    if (fs.existsSync(filePath)) {
        return res.json({ message: 'Upload completed', filePath: `/uploads/${fileName}` });
    } else {
        console.error('File not found:', filePath);
        return res.status(500).json({ error: 'File not found after upload' });
    }
});

// Home Route
app.get('/', (req, res) => {
    res.render('index', { title: 'Video Uploader' });
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

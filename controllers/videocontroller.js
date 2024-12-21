const fs = require('fs');
const path = require('path');

// Stream video for playback
const streamVideo = (req, res) => {
    const { filename } = req.params;
    const videoPath = path.join(__dirname, '..', 'uploads', filename);

    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video file not found' });
    }

    const stat = fs.statSync(videoPath);
    const range = req.headers.range;

    // Cleanup function to remove event listeners after stream finishes
    const cleanup = (videoStream) => {
        videoStream.removeAllListeners();
    };

    // Handling video streaming with range requests (for chunked playback)
    if (range) {
        const [start, end] = range.replace(/bytes=/, '').split('-').map(Number);

        const chunkStart = isNaN(start) ? 0 : start;
        const chunkEnd = isNaN(end) ? stat.size - 1 : end;

        // Ensure end is not greater than the file size
        const finalEnd = chunkEnd >= stat.size ? stat.size - 1 : chunkEnd;

        // Validate the start byte
        if (chunkStart >= stat.size || finalEnd < chunkStart) {
            return res.status(416).json({
                error: 'Requested Range Not Satisfiable',
                details: `Start byte: ${chunkStart}, End byte: ${finalEnd}, File size: ${stat.size}`,
            });
        }

        const videoStream = fs.createReadStream(videoPath, { start: chunkStart, end: finalEnd });

        // Send the response with appropriate headers
        res.writeHead(206, {
            'Content-Range': `bytes ${chunkStart}-${finalEnd}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': finalEnd - chunkStart + 1,
            'Content-Type': 'video/mp4', // Change this if you support other formats
        });

        videoStream.pipe(res);

        // Handle stream errors and cleanup after the stream finishes
        videoStream.on('error', (err) => {
            console.error('Error streaming video:', err);
            res.status(500).json({ error: 'Error streaming video', details: err.message });
        });

        // Cleanup listeners after stream finishes or closes
        videoStream.once('finish', () => cleanup(videoStream));
        videoStream.once('close', () => cleanup(videoStream));
        videoStream.once('error', () => cleanup(videoStream));

    } else {
        // No range provided, send the full video
        res.writeHead(200, {
            'Content-Type': 'video/mp4', // Adjust if you support other formats
            'Content-Length': stat.size,
        });

        const videoStream = fs.createReadStream(videoPath);
        videoStream.pipe(res);

        // Handle stream errors and cleanup after the stream finishes
        videoStream.on('error', (err) => {
            console.error('Error streaming video:', err);
            res.status(500).json({ error: 'Error streaming video', details: err.message });
        });

        // Cleanup listeners after the stream finishes or closes
        videoStream.once('finish', () => cleanup(videoStream));
        videoStream.once('close', () => cleanup(videoStream));
        videoStream.once('error', () => cleanup(videoStream));
    }
};

module.exports = { streamVideo };

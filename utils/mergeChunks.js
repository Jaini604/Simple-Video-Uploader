const fs = require('fs');
const path = require('path');

// Merge video chunks
const mergeChunks = async (chunkDir, outputFile) => {
    const chunkFiles = fs.readdirSync(chunkDir)
        .filter(file => file.startsWith('chunk-'))  // Only process chunk files
        .sort((a, b) => a.localeCompare(b)); // Ensure chunks are in the correct order

    const writeStream = fs.createWriteStream(outputFile);

    try {
        // Stream each chunk into the final file
        for (const chunkFile of chunkFiles) {
            const chunkPath = path.join(chunkDir, chunkFile);
            const chunkStream = fs.createReadStream(chunkPath);

            // Pipe chunk data to the output file without ending the writeStream
            chunkStream.pipe(writeStream, { end: false });

            // Wait for the chunk to finish writing
            await new Promise((resolve, reject) => {
                chunkStream.on('end', resolve);
                chunkStream.on('error', reject); // Handle any read errors
            });

            // Delete chunk file after writing to avoid space issues
            await fs.promises.unlink(chunkPath);
        }

        // Ensure the writeStream ends after all chunks are written
        writeStream.end();

        // Handle errors from the writeStream
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);  // Resolve when writeStream finishes
            writeStream.on('error', reject);   // Reject if there's an error in writeStream
        });

    } catch (error) {
        console.error('Error merging chunks:', error);
        throw error;  // Rethrow error to be handled by the caller
    }
};

module.exports = mergeChunks;

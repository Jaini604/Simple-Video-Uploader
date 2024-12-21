const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Convert MOV to MP4 using FFmpeg
const convertMovToMp4 = async (inputFilePath, outputFilePath) => {
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

// Export the conversion function
module.exports = { convertMovToMp4 };

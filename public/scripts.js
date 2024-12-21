const form = document.getElementById('upload-form');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('videoFile');
    const file = fileInput.files[0];

    if (file) {
        const formData = new FormData();
        const chunkSize = 20 * 1024; // 20KB per chunk (adjust as needed)
        let offset = 0;
        let chunkNumber = 0;
        const fileName = file.name;

        // Upload each chunk
        while (offset < file.size) {
            const chunk = file.slice(offset, offset + chunkSize);
            formData.set('chunk', chunk); // Add the current chunk to FormData
            formData.set('chunkNumber', chunkNumber.toString()); // Add chunk number as string
            formData.set('totalChunks', Math.ceil(file.size / chunkSize).toString()); // Total chunks
            formData.set('fileName', fileName); // Add original file name

            try {
                const response = await fetch('/api/upload/chunk', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log(`Chunk ${chunkNumber + 1} uploaded successfully`);

                    // Update offset for next chunk
                    offset += chunkSize;
                    chunkNumber++;
                } else {
                    const errorData = await response.json();
                    console.error('Error uploading chunk:', errorData);
                    alert(`File upload failed for chunk ${chunkNumber + 1}: ${errorData.error || 'Unknown error'}`);
                    break;
                }
            } catch (error) {
                alert('Error uploading chunk. Please try again.');
                console.error(error);
                break;
            }

            // Reinitialize formData for next chunk
            formData.delete('chunk');  // Clean up formData for the next chunk
        }

        // Once all chunks are uploaded, finalize the upload and handle video playback
        if (offset >= file.size) {
            alert('File uploaded successfully!');

            // Call backend to finalize the video upload and convert to MP4 if needed
            const finalResponse = await fetch('/api/upload/complete', {
                method: 'POST',
                body: JSON.stringify({ fileName: fileName }),  // Send original file name
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Check if the final response is OK
            if (finalResponse.ok) {
                const data = await finalResponse.json();
                let filePath = data.filePath;

                // Check if the file is MOV and convert it to MP4 if necessary
                if (fileName.toLowerCase().endsWith('.mov')) {
                    // Assuming the server will convert it to MP4 and return the new file path
                    filePath = data.filePath.replace('.mov', '.mp4');
                }

                // Create and display the video element dynamically
                const videoContainer = document.getElementById('video-player');
                const videoElement = document.createElement('video');
                videoElement.controls = true;
                videoElement.src = filePath;

                // Clear previous video and append the new one
                videoContainer.innerHTML = ''; // Clear previous video
                videoContainer.appendChild(videoElement);

                // Load and play the new video
                videoElement.load();
                videoElement.play();
            } else {
                const errorData = await finalResponse.json();
                alert(`Error finalizing video upload: ${errorData.error}`);
            }
        }
    }
});

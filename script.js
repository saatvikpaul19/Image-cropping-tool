const imageUpload = document.getElementById('imageUpload');
const canvas = document.getElementById('annotationCanvas');
const ctx = canvas.getContext('2d');
let img = new Image();
let scale = 1, panX = 0, panY = 0;
let startX, startY, isDrawing = false;
let boxes = [], undoneBoxes = [];
let isPanning = false, isPanMode = false;
let imgWidth, imgHeight, originalWidth, originalHeight;

// Event Listeners
imageUpload.addEventListener('change', handleImageUpload);
canvas.addEventListener('dblclick', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', finishDrawing);
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', endPan);
document.getElementById('zoomIn').addEventListener('click', zoomIn);
document.getElementById('zoomOut').addEventListener('click', zoomOut);
document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.getElementById('download').addEventListener('click', downloadImages);
document.getElementById('panMode').addEventListener('click', togglePanMode);
document.getElementById('resetZoom').addEventListener('click', resetZoom);
document.getElementById('resetPan').addEventListener('click', resetPan);
document.getElementById('resetBoxes').addEventListener('click', resetBoundingBoxes);

// Toggle Pan Mode
function togglePanMode() {
    isPanMode = !isPanMode;
    document.getElementById('panMode').textContent = isPanMode ? 'Draw Mode' : 'Pan Mode';
}

// Load Image and Reset States
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
            img.onload = function() {
                resetState();  // Reset everything when a new image is uploaded
                canvas.width = canvas.parentElement.offsetWidth;
                canvas.height = canvas.parentElement.offsetHeight;
                originalWidth = img.width;
                originalHeight = img.height;
                fitImageToCanvas();
                drawImage();
            };
        };
        reader.readAsDataURL(file);
    }
}

// Reset the application state
function resetState() {
    scale = 1;
    panX = 0;
    panY = 0;
    boxes = [];
    undoneBoxes = [];
    isDrawing = false;
    isPanning = false;
    isPanMode = false;
    document.getElementById('panMode').textContent = 'Pan Mode';  // Reset button text to 'Pan Mode'
    ctx.clearRect(0, 0, canvas.width, canvas.height);  // Clear the canvas
}

// Fit image into the canvas, maintaining aspect ratio
function fitImageToCanvas() {
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.width / img.height;

    if (imgRatio > canvasRatio) {
        imgWidth = canvas.width;
        imgHeight = canvas.width / imgRatio;
    } else {
        imgHeight = canvas.height;
        imgWidth = canvas.height * imgRatio;
    }

    panX = (canvas.width - imgWidth) / 2;
    panY = (canvas.height - imgHeight) / 2;
    scale = 1;
}

// Draw the image with bounding boxes and transformations
function drawImage() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, panX, panY);
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, imgWidth, imgHeight);
    drawBoxes();
}

// Draw bounding boxes on the canvas
function drawBoxes() {
    boxes.forEach(box => {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
    });
}

// Get mouse position relative to canvas, adjusted for zoom and pan
function getMousePosition(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left - panX) / scale,
        y: (e.clientY - rect.top - panY) / scale
    };
}

// Start Drawing Bounding Box
function startDrawing(e) {
    if (isPanMode) return;

    const pos = getMousePosition(e);
    startX = pos.x;
    startY = pos.y;
    isDrawing = true;
}

// Draw bounding box as the mouse moves
function draw(e) {
    if (isDrawing && !isPanMode) {
        const pos = getMousePosition(e);
        drawImage();
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
    } else if (isPanning) {
        panX += e.movementX;
        panY += e.movementY;
        drawImage();
    }
}

// Finish drawing the bounding box
function finishDrawing() {
    if (isDrawing && !isPanMode) {
        const pos = getMousePosition(event);
        const rect = {
            x: startX,
            y: startY,
            width: pos.x - startX,
            height: pos.y - startY
        };
        boxes.push(rect);
        undoneBoxes = [];
        isDrawing = false;
        drawImage();
    }
}

// Handle mousedown for drawing or panning
function handleMouseDown(e) {
    if (isPanMode) {
        startPan(e);
    } else {
        startDrawing(e);
    }
}

// Start panning the image
function startPan(e) {
    isPanning = true;
}

// End panning the image
function endPan() {
    isPanning = false;
}

// Zoom in function
function zoomIn() {
    scale *= 1.1;
    drawImage();
}

// Zoom out function
function zoomOut() {
    scale /= 1.1;
    drawImage();
}

// Undo last bounding box
function undo() {
    if (boxes.length > 0) {
        undoneBoxes.push(boxes.pop());
        drawImage();
    }
}

// Redo last undone bounding box
function redo() {
    if (undoneBoxes.length > 0) {
        boxes.push(undoneBoxes.pop());
        drawImage();
    }
}

// Download cropped images in a ZIP file
function downloadImages() {
    const zip = new JSZip();
    const promises = boxes.map((box, index) => {
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = box.width * scale;
        croppedCanvas.height = box.height * scale;
        const croppedCtx = croppedCanvas.getContext('2d');

        croppedCtx.drawImage(
            img,
            box.x * scale,
            box.y * scale,
            box.width * scale,
            box.height * scale,
            0,
            0,
            croppedCanvas.width,
            croppedCanvas.height
        );

        return new Promise((resolve) => {
            croppedCanvas.toBlob(blob => {
                zip.file(`cropped_image_${index + 1}.jpg`, blob);
                resolve();
            }, 'image/jpeg');
        });
    });

    Promise.all(promises).then(() => {
        zip.generateAsync({ type: 'blob' }).then((content) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'Cropped_Images.zip';
            link.click();
        });
    });
}

// Reset zoom to original scale
function resetZoom() {
    scale = 1;
    drawImage();
}

// Reset pan to original position
function resetPan() {
    fitImageToCanvas();
    drawImage();
}

// Reset bounding boxes
function resetBoundingBoxes() {
    boxes = [];
    drawImage();
}

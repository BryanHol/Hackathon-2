/*

    Canvas.js

    Peter Ursem

    Handle touch inputs and draw data to the canvas.

*/

class Artist {
    canvas;
    context;

    tool = 0;	// 0: Brush, 1: Bucket
    width = 5;	// Line in px
    colour = "#000000"; // Drawing colour

    actions = [];	// An array of CanvasAction objects

    last_pos = { x: -1, y: -1 };
    drawing = false;

    // Initialize the artist
    constructor () {
        this.canvas = document.getElementById('canvas');
        this.context = this.canvas.getContext('2d');

		// Bind functions
        this.handleStart = this.handleStart.bind(this);
        this.inputStart = this.inputStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.inputEnd = this.inputEnd.bind(this);

        document.getElementById("clear").addEventListener("click", () => {
            this.clear();
        });

        window.addEventListener('resize', () => {
            this.handleResize();
        });

        this.setupInput();
        
        this.swapTool(0, 5, "#000000ff");

        return this;
    }

    queueAction(data) {
        const to_pos = { x:data.x, y:data.y };
        
        // Draw if a previous position has been set
        if (this.last_pos.x != -1 || this.last_pos.y != -1 || data.tool == 1) {
			// Previous position set, queue a new action
            this.actions.push({
                start_x: this.last_pos.x, 
                start_y: this.last_pos.y, 
                end_x: data.x, 
                end_y: data.y,
                width: data.width ?? 0,
                colour: data.colour,
                tool: data.tool ?? 0
            });

            // Render this action
            this.render(this.actions[this.actions.length - 1]);
        }
        
		// Upgrade original position
        this.last_pos = to_pos; 
    }

    // Update the tool info
    // CALL THIS TO CHANGE COLOURS AND WIDTH
    swapTool(tool, width, colour) {
        this.tool = tool; 
        this.width = width;
        this.colour = colour;
    }

    fill(normalized_x, normalized_y, colour) {
        // 1. Convert normalized coordinates back to actual canvas pixel coordinates
        const startX = Math.floor(normalized_x * this.canvas.width);
        const startY = Math.floor(normalized_y * this.canvas.height);
        
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Out of bounds check
        if (startX < 0 || startY < 0 || startX >= width || startY >= height) return;

        // 2. Get the raw pixel data
        const imageData = this.context.getImageData(0, 0, width, height);
        const data = imageData.data; // 1D array representing [R, G, B, A, R, G, B, A...]

        // 3. Define target color and replacement color
        const startPos = (startY * width + startX) * 4;
        const targetR = data[startPos];
        const targetG = data[startPos + 1];
        const targetB = data[startPos + 2];
        const targetA = data[startPos + 3];

        const fillColor = hexToRgba(colour);

        // If the color is already the fill color, do nothing to prevent infinite loops
        if (targetR === fillColor[0] && targetG === fillColor[1] &&
            targetB === fillColor[2] && targetA === fillColor[3]) {
            return;
        }

        // Helper: Check if a pixel matches the target color we want to replace
        const matchTargetColor = (pixelPos) => {
            return data[pixelPos] === targetR &&
                   data[pixelPos + 1] === targetG &&
                   data[pixelPos + 2] === targetB &&
                   data[pixelPos + 3] === targetA;
        };

        // Helper: Apply the new color to a pixel
        const colorPixel = (pixelPos) => {
            data[pixelPos] = fillColor[0];
            data[pixelPos + 1] = fillColor[1];
            data[pixelPos + 2] = fillColor[2];
            data[pixelPos + 3] = fillColor[3];
        };

        // 4. Scanline Flood Fill implementation
        const pixelStack = [[startX, startY]];

        while (pixelStack.length > 0) {
            const newPos = pixelStack.pop();
            let x = newPos[0];
            let y = newPos[1];

            let pixelPos = (y * width + x) * 4;
            
            // Move Y up as far as we have matching target colors
            while (y >= 0 && matchTargetColor(pixelPos)) {
                y--;
                pixelPos -= width * 4;
            }

            // We went one pixel too far up, so step back down
            pixelPos += width * 4;
            y++;

            let reachLeft = false;
            let reachRight = false;

            // Move Y down, coloring as we go, and checking left/right for new branches
            while (y < height && matchTargetColor(pixelPos)) {
                colorPixel(pixelPos);

                // Check left
                if (x > 0) {
                    if (matchTargetColor(pixelPos - 4)) {
                        if (!reachLeft) {
                            pixelStack.push([x - 1, y]);
                            reachLeft = true;
                        }
                    } else if (reachLeft) {
                        reachLeft = false;
                    }
                }

                // Check right
                if (x < width - 1) {
                    if (matchTargetColor(pixelPos + 4)) {
                        if (!reachRight) {
                            pixelStack.push([x + 1, y]);
                            reachRight = true;
                        }
                    } else if (reachRight) {
                        reachRight = false;
                    }
                }

                y++;
                pixelPos += width * 4;
            }
        }

        // 5. Push the manipulated pixel data back onto the canvas
        this.context.putImageData(imageData, 0, 0);
    }

    // Draw the path described by the given CanvasAction
    render(canvasAction) {
        if (canvasAction.tool == 1) {
            this.fill(canvasAction.end_x, canvasAction.end_y, canvasAction.colour);
        } else {
        this.context.beginPath();

        this.context.lineJoin = "round";
        this.context.lineCap = "round";

        /* add tool type later */
        this.context.strokeStyle = canvasAction.colour;
        this.context.lineWidth = canvasAction.width * this.canvas.width;

        this.context.moveTo(canvasAction.start_x * this.canvas.width, canvasAction.start_y * this.canvas.height);
        this.context.lineTo(canvasAction.end_x * this.canvas.width, canvasAction.end_y * this.canvas.height);

        this.context.closePath();
        this.context.stroke();
        }
    }

    // Helper to extract relative coordinates for both mouse and touch events
    getCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (event.touches && event.touches.length > 0) {
             // Handle touch event
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            // Handle touch updates
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
            // Handle mouse event
            clientX = event.clientX;
            clientY = event.clientY;
        }

        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height
        };
    }

    handleStart(pos) {
        this.last_pos = pos;
        this.drawing = true;
    }

    inputStart(event) {
        event.preventDefault();

        const pos = this.getCoordinates(event);

        if (this.tool === 1) {           
            const action = { ...pos, tool: 1, colour: this.colour };
            this.last_pos = pos;
            this.queueAction(action);
            window.sendPacket("drawing", action);            
            this.drawing = false; // Don't allow dragging a fill
        } else {
            this.handleStart(pos);
            window.sendPacket("draw_start", pos);
        }

    }

    handleMove(event) {
        event.preventDefault();
        if (this.drawing && this.tool == 0) {
            const currentPos = this.getCoordinates(event);

            const action = { ...currentPos, tool: 0, width: this.width/this.canvas.width, colour: this.colour }

            this.queueAction(action);

            window.sendPacket("drawing", action);
        }
    }

    handleEnd() {
        this.drawing = false;
		// Reset original positon
        this.last_pos = { x: -1, y: -1 };
    }

    inputEnd(event) {
        event.preventDefault();

        this.handleEnd();

        window.sendPacket("draw_end", {});
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.actions = [];
    }

    redrawAll() {
        for (let i = 0; i < this.actions.length; i++) {
            this.render(this.actions[i]);
        }
    }

    handleResize() {
        const rect = this.canvas.getBoundingClientRect();
        
        // Update internal resolution to match actual display resolution for crisp lines
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // Changing dimensions clears the canvas natively, so we must redraw
        this.redrawAll();
    }

    // Enable drawing inputs
    setupInput() {
        // Touch Events
        this.canvas.addEventListener('touchstart', this.inputStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleMove, { passive: false });
        this.canvas.addEventListener('touchend', this.inputEnd);
        this.canvas.addEventListener('touchcancel', this.inputEnd);

        // Mouse Events
        this.canvas.addEventListener('mousedown', this.inputStart);
        this.canvas.addEventListener('mousemove', this.handleMove);
        this.canvas.addEventListener('mouseup', this.inputEnd);
        this.canvas.addEventListener('mouseout', this.inputEnd);
    }

    // Disable drawing inputs
    removeInput() {
        // Touch Events
        this.canvas.removeEventListener('touchstart', this.handleStart);
        this.canvas.removeEventListener('touchmove', this.handleMove);
        this.canvas.removeEventListener('touchend', this.handleEnd);
        this.canvas.removeEventListener('touchcancel', this.handleEnd);

        // Mouse Events
        this.canvas.removeEventListener('mousedown', this.handleStart);
        this.canvas.removeEventListener('mousemove', this.handleMove);
        this.canvas.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('mouseout', this.handleEnd);
    }
}

function hexToRgba(hex) {
    // Remove the hash if it exists
    hex = hex.replace(/^#/, '');

    // Parse the hex string
    let r, g, b, a = 255; // Default alpha to fully opaque

    if (hex.length === 3) {
        // 3-digit hex (e.g., #F00)
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        // 6-digit hex (e.g., #FF0000)
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 8) {
        // 8-digit hex with alpha (e.g., #FF0000FF)
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
        a = parseInt(hex.substring(6, 8), 16);
    }

    return [r, g, b, a];
}

let canvasArtist;
window.addEventListener('load', () => {
    canvasArtist = new Artist();

    // Queue a new action from a socket event
    window.canvasAction = (payload) => {canvasArtist.queueAction(payload);};

    window.canvasClear = () => {canvasArtist.clear();};
    window.canvasStart = canvasArtist.handleStart;
    window.canvasEnd = canvasArtist.handleEnd;

    document.getElementById("clear").addEventListener("click", () => {
        window.sendPacket("draw_clear", {});
        canvasArtist.clear();
    }); 
    document.getElementById("paint").addEventListener("click", () => {
        canvasArtist.swapTool(0, canvasArtist.width, document.getElementById("colour").value);
    });
    document.getElementById("eraser").addEventListener("click", () => {
        canvasArtist.swapTool(0, canvasArtist.width, "#ffffff");
    });
    document.getElementById("bucket").addEventListener("click", () => {
        canvasArtist.swapTool(1, canvasArtist.width, document.getElementById("colour").value);
    });
    document.getElementById("colour").addEventListener("change", () => {
        canvasArtist.swapTool(canvasArtist.tool, canvasArtist.width, document.getElementById("colour").value); 
    });
    document.getElementById("width").addEventListener("change", () => {
        canvasArtist.swapTool(canvasArtist.tool, document.getElementById("width").value, canvasArtist.colour);
    });

    window.makeSocket();
});


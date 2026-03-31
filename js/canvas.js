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
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);

        document.getElementById("clear").addEventListener("click", () => {
            this.clear();
        });

        this.setupInput();
        return this;
    }

    queueAction(to_pos) {
        // Check if a previous position has been set
        if (this.last_pos.x === -1 || this.last_pos.y === -1) {
			// Not set, set original position
            this.last_pos = to_pos;
            return;
        }

		// Previous position set, queue a new action
        this.actions.push({
            start_x: this.last_pos.x, 
            start_y: this.last_pos.y, 
            end_x: to_pos.x, 
            end_y: to_pos.y
        });

		// Render this action
        this.render(this.actions[this.actions.length - 1]);
        
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

    fill(at_pos) {
        // Code to fill the area at {x, y}
        // Ensure that this only fills unicolour areas ad respects lines
    }

    // Draw the path described by the given CanvasAction
    render(canvasAction) {
        this.context.beginPath();

        this.context.lineJoin = "round";
        this.context.lineCap = "round";

        this.context.strokeStyle = this.colour;
        this.context.lineWidth = this.width;

        this.context.moveTo(canvasAction.start_x, canvasAction.start_y);
        this.context.lineTo(canvasAction.end_x, canvasAction.end_y);

        this.context.closePath();
        this.context.stroke();
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
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    handleStart(event) {
        event.preventDefault();

        this.drawing = true;
        this.last_pos = this.getCoordinates(event);
    }

    handleMove(event) {
        event.preventDefault();
        if (this.drawing) {
            const currentPos = this.getCoordinates(event);
            this.queueAction(currentPos);
        }
    }

    handleEnd(event) {
        event.preventDefault();
        this.drawing = false;

		// Reset original positon
        this.last_pos = { x: -1, y: -1 };
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Enable drawing inputs
    setupInput() {
        // Touch Events
        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleMove, { passive: false });
        this.canvas.addEventListener('touchend', this.handleEnd);
        this.canvas.addEventListener('touchcancel', this.handleEnd);

        // Mouse Events
        this.canvas.addEventListener('mousedown', this.handleStart);
        this.canvas.addEventListener('mousemove', this.handleMove);
        this.canvas.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('mouseout', this.handleEnd);
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

window.addEventListener('load', () => {
    const canvasArtist = new Artist();
});
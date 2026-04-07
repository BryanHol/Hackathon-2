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

    messages = []; // An array of message objects in sequence

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

        this.setupInput();
        
        this.swapTool(0, 5, "#000000ff");

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

        /* add tool type later */
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

    handleStart(pos) {
        this.drawing = true;
        this.last_pos = pos;
    }

    inputStart(event) {
        event.preventDefault();

        const pos = this.getCoordinates(event);

        this.handleStart(pos);

        const json = { type:"draw_start", ...pos };
        window.sendJSON(json);
        this.messages.push(json)
    }

    handleMove(event) {
        event.preventDefault();
        if (this.drawing) {
            const currentPos = this.getCoordinates(event);
            this.queueAction(currentPos);

            const json = { type:"drawing", ...currentPos };
            window.sendJSON(json);
            this.messages.push(json);
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

        const json = { type:"draw_end" };
        window.sendJSON(json);
        this.messages.push(json);
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
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

let canvasArtist;
window.addEventListener('load', () => {
    canvasArtist = new Artist();

    // Queue a new action from a socket event
    window.canvasAction = (to_x, to_y) => {
        const to_pos = { x: to_x, y: to_y }
        canvasArtist.queueAction(to_pos);
    };

    window.canvasStart = canvasArtist.handleStart;
    window.canvasEnd = canvasArtist.handleEnd;
    window.canvasColour = (colour) => {canvasArtist.swapTool(canvasArtist.tool, canvasArtist.width, colour)};
    window.canvasWidth = (width) => {canvasArtist.swapTool(canvasArtist.tool, width, canvasArtist.colour)};

    document.getElementById("clear").addEventListener("click", () => {
        window.sendJSON({ type:"draw_clear" });
        canvasArtist.clear();
    }); 
    document.getElementById("paint").addEventListener("click", () => {
        window.sendJSON({ type:"draw_colour", colour:document.getElementById("colour").value });
        canvasArtist.swapTool(0, canvasArtist.width, document.getElementById("colour").value);
    });

    document.getElementById("eraser").addEventListener("click", () => {
        window.sendJSON({ type:"draw_colour", colour:"#ffffff" });
        canvasArtist.swapTool(0, canvasArtist.width, "#ffffff");
    });

    document.getElementById("colour").addEventListener("change", () => {
        window.sendJSON({ type:"draw_colour", colour:document.getElementById("colour").value });
        canvasArtist.swapTool(0, canvasArtist.width, document.getElementById("colour").value); 
    });

    document.getElementById("width").addEventListener("change", () => {
        window.sendJSON({ type:"draw_width", width: document.getElementById("width").value});
        canvasArtist.swapTool(0, document.getElementById("width").value, canvasArtist.colour);
    });
});

function playAllMessages() {
    for (message of canvasArtist.messages) {
        window.sendJSON(message);
    }
}

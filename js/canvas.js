class Artist {
    canvas;
    context;

    tool = 0;   // 0: Brush, 1: Bucket
    width = 5;  // Line in px
    colour = "#000000"; // Drawing colour

    actions = [];   // An array of CanvasAction objects

    last_pos = { x: -1, y: -1 };
    drawing = false;

    constructor() {
        this.canvas = document.getElementById("canvas");
        this.context = this.canvas.getContext("2d");

        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);

        this.setupInput();
        return this;
    }

    queueAction(to_pos) {
        if (this.last_pos.x === -1 || this.last_pos.y === -1) {
            this.last_pos = to_pos;
            return;
        }

        const action = {
            start_x: this.last_pos.x,
            start_y: this.last_pos.y,
            end_x: to_pos.x,
            end_y: to_pos.y,
            colour: this.colour,
            width: this.width,
            session_id: window.getCollabSessionId()
        };

        this.actions.push(action);
        this.render(action);

        window.sendCollabMessage({
            type: "canvas_stroke",
            room: window.getCollabRoomName(),
            client_id: localStorage.getItem("clientId") || "",
            username: sessionStorage.getItem("savedUsername") || "Anonymous",
            stroke: action
        });

        this.last_pos = to_pos;
    }

    swapTool(tool, width, colour) {
        this.tool = tool;
        this.width = width;
        this.colour = colour;
    }

    render(canvasAction) {
        this.context.beginPath();

        this.context.lineJoin = "round";
        this.context.lineCap = "round";

        this.context.strokeStyle = canvasAction.colour || this.colour;
        this.context.lineWidth = canvasAction.width || this.width;

        this.context.moveTo(canvasAction.start_x, canvasAction.start_y);
        this.context.lineTo(canvasAction.end_x, canvasAction.end_y);

        this.context.closePath();
        this.context.stroke();
    }

    getCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX;
        let clientY;

        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
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
        this.last_pos = { x: -1, y: -1 };
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setupInput() {
        this.canvas.addEventListener("touchstart", this.handleStart, { passive: false });
        this.canvas.addEventListener("touchmove", this.handleMove, { passive: false });
        this.canvas.addEventListener("touchend", this.handleEnd);
        this.canvas.addEventListener("touchcancel", this.handleEnd);

        this.canvas.addEventListener("mousedown", this.handleStart);
        this.canvas.addEventListener("mousemove", this.handleMove);
        this.canvas.addEventListener("mouseup", this.handleEnd);
        this.canvas.addEventListener("mouseout", this.handleEnd);
    }

    removeInput() {
        this.canvas.removeEventListener("touchstart", this.handleStart);
        this.canvas.removeEventListener("touchmove", this.handleMove);
        this.canvas.removeEventListener("touchend", this.handleEnd);
        this.canvas.removeEventListener("touchcancel", this.handleEnd);

        this.canvas.removeEventListener("mousedown", this.handleStart);
        this.canvas.removeEventListener("mousemove", this.handleMove);
        this.canvas.removeEventListener("mouseup", this.handleEnd);
        this.canvas.removeEventListener("mouseout", this.handleEnd);
    }
}

window.addEventListener("load", () => {
    const canvasArtist = new Artist();
    const socket = window.ensureCollabSocket();
    const colourInput = document.getElementById("colour");
    const widthInput = document.getElementById("width");
    const paintRadio = document.getElementById("paint");
    const eraserRadio = document.getElementById("eraser");

    if (colourInput) {
        colourInput.addEventListener("input", () => {
            if (!eraserRadio || !eraserRadio.checked) {
                canvasArtist.colour = colourInput.value;
            }
        });
    }

    if (widthInput) {
        widthInput.addEventListener("input", () => {
            canvasArtist.width = Number(widthInput.value);
        });
    }

    if (paintRadio) {
        paintRadio.addEventListener("change", () => {
            if (paintRadio.checked) {
                canvasArtist.colour = colourInput ? colourInput.value : "#000000";
            }
        });
    }

    if (eraserRadio) {
        eraserRadio.addEventListener("change", () => {
            if (eraserRadio.checked) {
                canvasArtist.colour = "#FFFFFF";
            }
        });
    }

    socket.addEventListener("message", (event) => {
        const payload = JSON.parse(event.data);

        if (payload.type === "user_registered" && payload.user && payload.user.client_id) {
            localStorage.setItem("clientId", payload.user.client_id);
            return;
        }

        if (payload.type === "init_state") {
            canvasArtist.clear();
            canvasArtist.actions = [];

            for (const storedStroke of payload.state.strokes) {
                if (storedStroke.stroke) {
                    canvasArtist.actions.push(storedStroke.stroke);
                    canvasArtist.render(storedStroke.stroke);
                }
            }
            return;
        }

        if (payload.type === "canvas_stroke") {
            const incomingStroke = payload.stroke && payload.stroke.stroke
                ? payload.stroke.stroke
                : null;

            if (!incomingStroke) {
                return;
            }

            if (incomingStroke.session_id === window.getCollabSessionId()) {
                return;
            }

            canvasArtist.actions.push(incomingStroke);
            canvasArtist.render(incomingStroke);
            return;
        }

        if (payload.type === "canvas_cleared") {
            canvasArtist.actions = [];
            canvasArtist.clear();
        }
    });

    document.getElementById("clear").addEventListener("click", () => {
        window.sendCollabMessage({
            type: "clear_canvas",
            room: window.getCollabRoomName(),
            client_id: localStorage.getItem("clientId") || "",
            username: sessionStorage.getItem("savedUsername") || "Anonymous"
        });
    });
});
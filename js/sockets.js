/*

    Sockets.js

    Peter Ursem & David Caudron

    Handle live IO from the server and pass data to the chat and canvas handlers.

*/

const socket = new WebSocket('ws://'+window.location.hostname+':8000');

// Connection opened
socket.addEventListener("open", (event) => {
    // If we need to send UUID or "join_room", we can do that here
    window.sendPacket("join_room", {});
});

// Construct and send JSON packet to server
window.sendPacket = function(type, data) {
    // Construct packet    
    const packet = JSON.stringify({
        header: {
            type: type, // packet type (string) for routing and parsing by server
            sender: window.user.username, // should this be sessionId instead?
            room: window.user.room,
            team: window.user.team,
            time: Date.now() // packet timestamp
        },
        payload: data
    });
    // Send packet
    socket.send(packet);
};

// Listen for messages
socket.addEventListener("message", (event) => {
    console.log("Message from server ", event.data);

    // Turn string from socket into a JSON object
    const data = JSON.parse(event.data);

    if(!data.header) {
        console.log("INVALID WS MESSAGE RECEIVED");
        return
    }

    if(data.header.type == "message"){
        // Place message into DOM
        window.showMessage(data.payload);
    } 
    else if (data.header.type == "draw_clear")
        window.canvasClear();
    else if (data.header.type == "drawing")
        window.canvasAction(data.payload);
    else if (data.header.type == "draw_start")
        window.canvasStart(data.payload);
    else if (data.header.type == "draw_end")
        window.canvasEnd();

});
const WebSocket = require('ws');

// Create a WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8000 });

wss.on('connection', (ws) => {
  console.log('New client connected');

  // Listen for messages from this specific client
  ws.on('message', (data) => {
    console.log(`Received message: ${data}`);

    // Broadcast the message to all other connected clients
    wss.clients.forEach((client) => {
      // Check if the client is not the sender and the connection is open
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket server is running on ws://localhost:8000');

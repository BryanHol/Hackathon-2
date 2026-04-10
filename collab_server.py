"""
Filename: collab_server.py
Author: Bryan Holl
Team Members: David Caudron, Peter Ursem, and Andrea Restrepo

Purpose: 
Refactoring of collab server to restore proper dependencites on js scripts.
The new server code also attempts to remove the latency issue found in the code.
"""

# Necessary imports
import asyncio          # contains APIs for asynchronous connections
from websockets.asyncio.server import serve       # contains websocket server and client APIs
import json             # needed for saving session data in json format
import time             # needed for timeouts
from pathlib import Path # needed for file handling; due to MacOS file system
                        # inconsistencies.
import uuid             # needed for generating unique user IDs

def current_timestamp():
    """
    No parameters. Returns the current timestamp in human-readable format.
    """
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

class AppModel:
    #########################################################################
    # Important Model Set-Up Functions
    #########################################################################
    """
    Store all shared application data.

    This object is the server's in-memory model of the application.
    """

    def __init__(self) -> None:
        """
        Initialize the AppModel with a .json save file to store model data.
        No parameters.
        """

        self.save_file = "app_model.json" # File to save model data to and load model data from

        self.users = {} # Dictionary to store user data, keyed by user ID;
                        # Values are string for user ID and inner dict for
                        # user data/records

        self.rooms = {} # Dictionary for storing room data, keyed by room ID;
                        # Values are string for room ID and inner dict for
                        # the room data/records, where each record is a dict
                        # of the event ID and event data for that event, which
                        # is also a dict of the event attribute and values.

        # ID counters for generating unique IDs for every message sent, every
        # event created, and every action on the canvas. Useful for tracking
        # the current state of the model.
        self.event_id = 1
        self.message_id = 1
        self.stroke_id = 1

        self.load_model() # Loads model data from save file; initially, it is empty

        self.game_state = "lobby" # Changes to game if triggered

    def create_room(self, room_id: str) -> dict:
        """
        Creates a new room with the given room ID.

        :param room_id: The ID of the room to create. This can be anything
        from a random string to a user-specified name, but it must be unique.
        """
        # Guard against creating a room with an ID that already exists
        if room_id not in self.rooms:
            self.rooms[room_id] = {
            "messages": [],
            "strokes": [],
            "events": [],
        }
            
        return self.rooms[room_id]
        
    def load_model(self) -> None:
        """
        Loads model data from the save file.

        No params.
        """
        path = Path(self.save_file)
        if not path.is_file():
            return # If the file doesn't exist, return; the model is empty
        
        with path.open("r") as file:
            data = json.load(file)
        
        self.users = data.get("users", {})
        self.rooms = data.get("rooms", {})

        # If no room has yet been created, creates a default room named
        # "main"; occurs if the ...?room=<name> is not used when connecting to
        # the server.
        if not self.rooms:
            self.rooms["main"] = {
                "messages": data.get("messages", []),
                "strokes": data.get("strokes", []),
                "events": data.get("events", []),
            }

        self.event_id = data.get("next_event_id", 1)
        self.message_id = data.get("next_message_id", 1)
        self.stroke_id = data.get("next_stroke_id", 1)

    def save_model(self) -> None:
        """
        Saves model data to the .json save file.

        No params.
        """
        data = {
            "users": self.users,
            "rooms": self.rooms,
            "event_id": self.event_id,
            "message_id": self.message_id,
            "stroke_id": self.stroke_id,
        }

        path = Path(self.save_file)
        with path.open("w") as file:
            json.dump(data, file)
        
    #########################################################################
    # Event Handling Functions
    #########################################################################
    def add_event(self, data: dict):
        """
        Adds an event to the model's event log.
    
        :param data: A dictionary containing the event data, such as the message text or stroke coordinates.

        Returns a dictionary containing the event data.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        room_state = self.create_room(header["room"])
        event = {
            "event_id": self.event_id, # Only used for record keeping; not used by client
            "header": header,
            "payload": payload
        }
        self.event_id += 1 # Increments event ID so every event has a unique ID
        room_state["events"].append(event)
        return event

    def add_user(self, data: dict):
        """
        Adds a user to the model's user list. Either creates a new user
        or updates an existing user.

        :param payload: A dictionary containing the user data, such as the user ID and username.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        user_id = header.get("sender")
        username = payload.get("username", "Anonymous")

        if user_id and user_id in self.users:
            self.users[user_id]["username"] = username
            self.users[user_id]["last_seen"] = current_timestamp()
            user = dict(self.users[user_id])
        
        else:
            user_id = str(uuid.uuid4()) # Generates a unique user ID using uuid4
            user = {
                "user_id": user_id,
                "username": username,
                "last_seen": current_timestamp(),
            }
            self.users[user_id] = user

        room = str(payload.get("room", "main")).strip()
        self.add_event(data)
        self.save_model()
        return dict(user)
    
    def get_user(self, data: dict):
        """
        Retrieves a user's data from the model. Also updates the user's last seen timestamp
        and updates username in model if needed. If the user does not exist, creates a new
        user.

        :param data: A dictionary containing the user data.

        Returns a dictionary containing the user's data, or None if the user does not exist.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        user_id = header.get("sender")
        if user_id and user_id in self.users:
            self.users[user_id]["last_seen"] = current_timestamp()
            if "username" in payload:
                self.users[user_id]["username"] = payload["username"]
            self.save_model()
            return dict(self.users[user_id])
        return self.add_user(data)

    # Functions for the text chat
    def add_message(self, data: dict):
        """
        Adds a message to the model's message list for a given room.
        
        :param data: A dictionary containing the message data, such as the room ID, user ID, and message text.
        
        Returns a dictionary containing the message data.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        room = str(header.get("room", "main")).strip()
        room_state = self.create_room(room)
        message = {
            "messageText": payload.get("messageText", ""),
            "username": payload.get("username", "Anonymous"),
            "timeStamp": current_timestamp()
        }
        self.message_id += 1
        room_state["messages"].append(message)
        self.add_event(data)
        self.save_model()
        return dict(message)

    # Functions for the canvas
    def draw_clear(self, data: dict):
        """
        Remove all strokes.

        :param data: A dictionary containing the room data.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        room = str(header.get("room", "main")).strip()
        room_state = self.create_room(room)
        user = self.add_user(data)
        room_state["strokes"] = []
        clear_info = {
            "room": room,
            "user_id": user["user_id"],
            "cleared_by": user["username"],
            "time": current_timestamp(),
        }
        self.add_event(data)
        self.save_model()
        return dict(clear_info)
    
    def add_stroke(self, data: dict):
        """
        Adds a stroke to the model's stroke list for a given room.

        :param data: A dictionary containing the data for the stroke.

        Returns a dictionary containing the stroke data.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        room = str(header.get("room", "main")).strip()
        room_state = self.create_room(room)
        user = self.add_user(data)
        stroke = {
            "stroke_id": self.stroke_id,
            "client_id": user["user_id"],
            "username": user["username"],
            "color": payload.get("color", "#000000"),
            "thickness": payload.get("width", 1),
            "time": current_timestamp(),
            "x": payload.get("x", 0),
            "y": payload.get("y", 0),
        }
        self.stroke_id += 1
        room_state["strokes"].append(stroke)
        self.add_event(data)
        self.save_model()
        return dict(stroke)
    
    def get_room_state(self, room: str):
        """
        Return the full shared model for one room.

        :param room: The ID of the room to get the state for.

        Returns a dictionary containing the users, messages, strokes, and latest event ID for the room.
        """
        room_state = self.create_room(room)
        return {
            "users": dict(self.users),
            "messages": list(room_state["messages"]),
            "strokes": list(room_state["strokes"]),
            "latest_event_id": self.event_id - 1,
            "gamestate": self.game_state,
        }

class WebSocketServer:
    """
    WebSocket server for handling client connections and communication.
    This server uses the AppModel to manage the shared state of the application and
    respond to client events.
    """

    #########################################################################
    # Important Server Set-Up Functions
    #########################################################################

    def __init__(self):
        """
        Initializes the WebSocket server with an instance of the AppModel and sets up
        the server's host, port, and connections dictionary.
        """
        self.model = AppModel() # The server's in-memory model of the application
        self.host = "localhost"
        self.port = 8000 # Default port, though can be changed if needed
        self.connections = {}
        self.active_drawings = {} # Dictionary to track active drawings for each room, keyed by room ID


    def get_room_connections(self, room: str):
        """
        Returns a set of all connections for a given room. If the room does
        not exist, it creates a new empty set for that room and returns it.

        :param room: The ID of the room to get the connections for.
        """
        if room not in self.connections:
            self.connections[room] = set() # Initialize a set to store connections for the room
        return self.connections[room]

    #########################################################################
    # Event Handling
    #########################################################################
    async def handle_event(self, websocket):
        """
        Main websocket event handler. Listens for incoming messages, and sends
        back responses. Note all try and except guards are removed in order to 
        (attempt to) reduce latency. In the future, it can be restored if
        error handling is needed.

        :param websocket: The websocket connection to handle events for.

        Note: ALL EVENTS ARE ASSUMED TO BE SENT WITH THE FOLLOWING FORMAT
        AS A JSON PACKET:
        {
            "header": {
                "type": <event_type>,
                "sender": <user_id>,
                "room": <room_id>,
                "team": <team_id>,
                "time": <timestamp>
            },
            "payload": {
                ...event-specific data...
            }
        }
        """
        room = "main" # Default room is "main"; if the client doesn't specify a room, they will be placed in the main room
        try:
            wait = await websocket.recv() # Waits for the first message from the client, which should contain the room information
            data = json.loads(wait)

            header = data.get("header", {}) # Header should contain type, sender, room, team, and time

            room = str(header.get("room", "main")).strip()
            self.get_room_connections(room).add(websocket) # Add the websocket connection to the set of connections for the room
            
            user = self.model.get_user(data) # Get user data from the sender
            self.get_room_connections(room).add(websocket) # Add the websocket connection to the set of connections for the room

            # Registers the user and sends message over websocket
            await websocket.send(json.dumps({
                "type": "user_registered",
                "user": user
            }))

            # Constructs the initial state of the room and sends it over the websocket
            # Is this used???
            await websocket.send(json.dumps({
                "type": "initial_state",
                "room": room,
                "state": self.model.get_room_state(room)
            }))

            async for wait in websocket: # Listens for incoming messages from the client
                data = json.loads(wait)
                header = data.get("header", {}) # Header should contain type, sender, room, team, and time
                payload = data.get("payload", {})

                header["room"] = room # Ensure the room is included in the data for event handling

                # Begin event handling based on the type of event received from the client
                event_type = header.get("type", "none")

                # Text Chat Events
                # (1) Username is saved into the top box
                # Note: NOT CURRENTLY USED IN THE CLIENT CODE, but it can be restored in the future if needed for user registration and updates.
                # if event_type == "save_user":
                #     user = self.model.add_user(data)
                #     await websocket.send(json.dumps({
                #         "type": "user_updated",
                #         "user": user
                #     }))

                # (2) Message is added to the chat and sent to all clients in the room
                if event_type == "message":
                    message = self.model.add_message(data)
                    await websocket.send(json.dumps({
                        "header": header,
                        "payload": {
                        "messageText": message["messageText"],
                        "username": message["username"],
                        "timeStamp": message["timeStamp"]
                        }
                    }))

                # Canvas Events
                # (1) Drawing is cleared; doesn't send any payload back
                elif event_type == "draw_clear":
                    await websocket.send(json.dumps({
                        "header": header,
                        "payload": {}
                    }))

                # (2) Drawing on the canvas 
                elif event_type == "draw_start":
                    start_info = self.model.add_stroke(data)
                    await websocket.send(json.dumps({
                        "header": header,
                        "payload": {
                        "x": start_info["x"],
                        "y": start_info["y"]
                        }
                    }))

                elif event_type == "drawing":
                    stroke_info = self.model.add_stroke(data)
                    await websocket.send(json.dumps({
                        "header": header,
                        "payload": {
                        "x": stroke_info["x"],
                        "y": stroke_info["y"],
                        "width": stroke_info["thickness"],
                        "color": stroke_info["color"]
                        }
                    }))

                elif event_type == "draw_end":
                    await websocket.send(json.dumps({
                        "header": header,
                        "payload": {}
                    }))
                
                elif event_type == "join_team":
                    await websocket.send(json.dumps({
                        "header": header,
                        "payload": {
                        "requested_team": payload.get("team")}
                    }))

                else:
                    # Not sure if error handling is accepted client-side
                    await websocket.send(json.dumps({
                        "header": {"type": "error"},
                        "payload": {
                            "message": f"Unknown event type: {event_type}"
                        }
                    }))

            # Remove open websockets when the connection is closed
        finally:
            self.get_room_connections(room).discard(websocket)
        
    async def serve_forever(self) -> None:
        async with serve(self.handle_event, self.host, self.port):
            print(f"WebSocket server running on ws://{self.host}:{self.port}")
            print("Use Ctrl+C to stop the server.")
            await asyncio.Future()

            
def main() -> None:
    server = WebSocketServer()

    try:
        asyncio.run(server.serve_forever())
    except KeyboardInterrupt:
        print("\nServer stopping...")

if __name__ == "__main__":
    main()





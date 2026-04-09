"""
"""

import asyncio
import json
import time
import uuid
from pathlib import Path
from typing import Any

from websockets.asyncio.server import ServerConnection, broadcast, serve


def current_timestamp() -> str:
    """Return a simple timestamp for collaboration events."""
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())


class AppModel:
    """
    Store all shared application data.

    This object is the server's in-memory model of the application.
    Since this version assumes one message is processed at a time,
    the data can be changed directly without any locking.
    """

    def __init__(self, save_file: str = "collab_state.json") -> None:
        self.save_file = save_file
        self.users: dict[str, dict[str, Any]] = {}
        self.rooms: dict[str, dict[str, list[dict[str, Any]]]] = {}
        self.next_event_id = 1
        self.next_message_id = 1
        self.next_stroke_id = 1
        self.load_from_disk()

    def ensure_room(self, room: str) -> dict[str, list[dict[str, Any]]]:
        if room not in self.rooms:
            self.rooms[room] = {
                "messages": [],
                "strokes": [],
                "events": [],
            }

        self.rooms[room].setdefault("messages", [])
        self.rooms[room].setdefault("strokes", [])
        self.rooms[room].setdefault("events", [])
        return self.rooms[room]

    def load_from_disk(self) -> None:
        """Load previous state from disk if a save file already exists."""
        path = Path(self.save_file)
        if not path.exists():
            return

        with path.open("r", encoding="utf-8") as infile:
            data = json.load(infile)

        self.users = data.get("users", {})
        self.rooms = data.get("rooms", {})

        if not self.rooms:
            self.rooms["main"] = {
                "messages": data.get("messages", []),
                "strokes": data.get("strokes", []),
                "events": data.get("events", []),
            }

        self.next_event_id = data.get("next_event_id", 1)
        self.next_message_id = data.get("next_message_id", 1)
        self.next_stroke_id = data.get("next_stroke_id", 1)

    def save_to_disk(self) -> None:
        """Write the current model to a JSON file."""
        data = {
            "users": self.users,
            "rooms": self.rooms,
            "next_event_id": self.next_event_id,
            "next_message_id": self.next_message_id,
            "next_stroke_id": self.next_stroke_id,
        }

        path = Path(self.save_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as outfile:
            json.dump(data, outfile, ensure_ascii=False, indent=2)

    def add_event(self, room: str, event_type: str, data: dict[str, Any]) -> dict[str, Any]:
        """Create one event entry and add it to the event log."""
        room_state = self.ensure_room(room)
        event = {
            "event_id": self.next_event_id,
            "room": room,
            "type": event_type,
            "time": current_timestamp(),
            "data": data,
        }
        self.next_event_id += 1
        room_state["events"].append(event)
        return event

    def register_user(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a new user or update an existing one."""
        client_id = payload.get("client_id")
        username = payload.get("username", "Anonymous")

        if client_id and client_id in self.users:
            self.users[client_id]["username"] = username
            self.users[client_id]["last_seen"] = current_timestamp()
            user = dict(self.users[client_id])
        else:
            client_id = str(uuid.uuid4())
            user = {
                "client_id": client_id,
                "username": username,
                "last_seen": current_timestamp(),
            }
            self.users[client_id] = user

        room = str(payload.get("room", "main")).strip() or "main"
        self.add_event(room, "user_updated", user)
        self.save_to_disk()
        return dict(user)

    def ensure_user(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Return an existing user if possible, otherwise create one."""
        client_id = payload.get("client_id")
        if client_id and client_id in self.users:
            self.users[client_id]["last_seen"] = current_timestamp()
            if "username" in payload:
                self.users[client_id]["username"] = payload["username"]
            self.save_to_disk()
            return dict(self.users[client_id])

        return self.register_user(payload)

    def add_message(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Store one chat message and add a matching event."""
        room = str(payload.get("room", "main")).strip() or "main"
        room_state = self.ensure_room(room)
        user = self.ensure_user(payload)
        message = {
            "message_id": self.next_message_id,
            "room": room,
            "client_id": user["client_id"],
            "username": user["username"],
            "text": payload.get("text", ""),
            "time": current_timestamp(),
        }
        self.next_message_id += 1
        room_state["messages"].append(message)
        self.add_event(room, "chat_message", message)
        self.save_to_disk()
        return dict(message)

    def add_stroke(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Store one canvas stroke and add a matching event."""
        room = str(payload.get("room", "main")).strip() or "main"
        room_state = self.ensure_room(room)
        user = self.ensure_user(payload)
        stroke = {
            "stroke_id": self.next_stroke_id,
            "room": room,
            "client_id": user["client_id"],
            "username": user["username"],
            "stroke": dict(payload.get("stroke", {})),
            "time": current_timestamp(),
        }
        self.next_stroke_id += 1
        room_state["strokes"].append(stroke)
        self.add_event(room, "canvas_stroke", stroke)
        self.save_to_disk()
        return dict(stroke)

    def clear_canvas(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Remove all strokes and record a canvas-cleared event."""
        room = str(payload.get("room", "main")).strip() or "main"
        room_state = self.ensure_room(room)
        user = self.ensure_user(payload)
        room_state["strokes"] = []
        clear_info = {
            "room": room,
            "client_id": user["client_id"],
            "cleared_by": user["username"],
            "time": current_timestamp(),
        }
        self.add_event(room, "canvas_cleared", clear_info)
        self.save_to_disk()
        return dict(clear_info)

    def get_room_state(self, room: str) -> dict[str, Any]:
        """Return the full shared model for one room."""
        room_state = self.ensure_room(room)
        return {
            "users": dict(self.users),
            "messages": list(room_state["messages"]),
            "strokes": list(room_state["strokes"]),
            "latest_event_id": self.next_event_id - 1,
        }


class CollaborationWebSocketServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 8000, save_file: str = "collab_state.json") -> None:
        self.host = host
        self.port = port
        self.model = AppModel(save_file=save_file)
        self.connections_by_room: dict[str, set[ServerConnection]] = {}

    def get_room_connections(self, room: str) -> set[ServerConnection]:
        if room not in self.connections_by_room:
            self.connections_by_room[room] = set()
        return self.connections_by_room[room]

    async def handler(self, websocket: ServerConnection) -> None:
        room = "main"
        user: dict[str, Any] | None = None

        try:
            raw = await websocket.recv()
            payload = json.loads(raw)

            if payload.get("type") != "join_room":
                await websocket.send(json.dumps({
                    "type": "error",
                    "error": "First message must be join_room"
                }))
                return

            room = str(payload.get("room", "main")).strip() or "main"
            payload["room"] = room

            user = self.model.ensure_user(payload)
            self.get_room_connections(room).add(websocket)

            await websocket.send(json.dumps({
                "type": "user_registered",
                "user": user
            }, ensure_ascii=False))

            await websocket.send(json.dumps({
                "type": "init_state",
                "room": room,
                "state": self.model.get_room_state(room)
            }, ensure_ascii=False))

            async for raw in websocket:
                payload = json.loads(raw)
                payload["room"] = room
                payload.setdefault("client_id", user["client_id"])
                payload.setdefault("username", user["username"])

                message_type = payload.get("type")

                if message_type == "set_username":
                    user = self.model.ensure_user(payload)
                    await websocket.send(json.dumps({
                        "type": "user_registered",
                        "user": user
                    }, ensure_ascii=False))
                    continue

                if message_type == "chat_message":
                    message = self.model.add_message(payload)
                    broadcast(
                        self.get_room_connections(room),
                        json.dumps({
                            "type": "chat_message",
                            "message": message
                        }, ensure_ascii=False)
                    )
                    continue

                if message_type == "canvas_stroke":
                    stroke = self.model.add_stroke(payload)
                    broadcast(
                        self.get_room_connections(room),
                        json.dumps({
                            "type": "canvas_stroke",
                            "stroke": stroke
                        }, ensure_ascii=False)
                    )
                    continue

                if message_type == "clear_canvas":
                    clear_info = self.model.clear_canvas(payload)
                    broadcast(
                        self.get_room_connections(room),
                        json.dumps({
                            "type": "canvas_cleared",
                            "clear": clear_info
                        }, ensure_ascii=False)
                    )
                    continue

                await websocket.send(json.dumps({
                    "type": "error",
                    "error": f"Unknown message type: {message_type}"
                }, ensure_ascii=False))

        except json.JSONDecodeError:
            await websocket.send(json.dumps({
                "type": "error",
                "error": "Invalid JSON"
            }, ensure_ascii=False))
        finally:
            if room in self.connections_by_room:
                self.connections_by_room[room].discard(websocket)
                if not self.connections_by_room[room]:
                    del self.connections_by_room[room]

    async def serve_forever(self) -> None:
        async with serve(self.handler, self.host, self.port):
            print(f"WebSocket server running on ws://{self.host}:{self.port}")
            print("Use Ctrl+C to stop the server.")
            await asyncio.Future()


def main() -> None:
    server = CollaborationWebSocketServer()

    try:
        asyncio.run(server.serve_forever())
    except KeyboardInterrupt:
        print("\nServer stopping...")


if __name__ == "__main__":
    main()

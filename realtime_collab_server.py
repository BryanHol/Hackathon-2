"""
"""

import json
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, cast
from urllib.parse import parse_qs, urlparse

def current_timestamp() -> str:
    """Return a simple timestamp for polling """
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

class AppModel:
    """
    Store all shared application data.

    This object is the server's in-memory model of the application.
    Since this version assumes one request is processed at a time,
    the data can be changed directly without any locking.
    """

    def __init__(self, save_file: str = "collab_state.json") -> None:
        self.save_file = save_file
        self.users = {}
        self.messages = []
        self.strokes = []
        self.events = []
        self.next_event_id = 1
        self.next_message_id = 1
        self.next_stroke_id = 1
        self.load_from_disk()

    def load_from_disk(self) -> None:
        """Load previous state from disk if a save file already exists."""
        path = Path(self.save_file)
        if not path.exists():
            return

        with path.open("r", encoding="utf-8") as infile:
            data = json.load(infile)

        self.users = data.get("users", {})
        self.messages = data.get("messages", [])
        self.strokes = data.get("strokes", [])
        self.events = data.get("events", [])
        self.next_event_id = data.get("next_event_id", 1)
        self.next_message_id = data.get("next_message_id", 1)
        self.next_stroke_id = data.get("next_stroke_id", 1)

    def save_to_disk(self) -> None:
        """Write the current model to a JSON file."""
        data = {
            "users": self.users,
            "messages": self.messages,
            "strokes": self.strokes,
            "events": self.events,
            "next_event_id": self.next_event_id,
            "next_message_id": self.next_message_id,
            "next_stroke_id": self.next_stroke_id,
        }

        path = Path(self.save_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as outfile:
            json.dump(data, outfile, ensure_ascii=False, indent=2)

    def add_event(self, event_type: str, data: dict[str, Any]) -> dict[str, Any]:
        """Create one event entry and add it to the event log."""
        event = {
            "event_id": self.next_event_id,
            "type": event_type,
            "time": current_timestamp(),
            "data": data,
        }
        self.next_event_id += 1
        self.events.append(event)
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

        self.add_event("user_updated", user)
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
        user = self.ensure_user(payload)
        message = {
            "message_id": self.next_message_id,
            "client_id": user["client_id"],
            "username": user["username"],
            "text": payload.get("text", ""),
            "time": current_timestamp(),
        }
        self.next_message_id += 1
        self.messages.append(message)
        self.add_event("chat_message", message)
        self.save_to_disk()
        return dict(message)

    def add_stroke(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Store one canvas stroke and add a matching event."""
        user = self.ensure_user(payload)
        stroke = {
            "stroke_id": self.next_stroke_id,
            "client_id": user["client_id"],
            "username": user["username"],
            "stroke": dict(payload.get("stroke", {})),
            "time": current_timestamp(),
        }
        self.next_stroke_id += 1
        self.strokes.append(stroke)
        self.add_event("canvas_stroke", stroke)
        self.save_to_disk()
        return dict(stroke)

    def clear_canvas(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Remove all strokes and record a canvas-cleared event."""
        user = self.ensure_user(payload)
        self.strokes = []
        clear_info = {
            "client_id": user["client_id"],
            "cleared_by": user["username"],
            "time": current_timestamp(),
        }
        self.add_event("canvas_cleared", clear_info)
        self.save_to_disk()
        return dict(clear_info)

    def get_state(self) -> dict[str, Any]:
        """Return the full shared model."""
        return {
            "users": dict(self.users),
            "messages": list(self.messages),
            "strokes": list(self.strokes),
            "latest_event_id": self.next_event_id - 1,
        }

    def get_updates(self, after_event_id: int) -> dict[str, Any]:
        """Return only events with an id greater than after_event_id."""
        new_events = [event for event in self.events if event["event_id"] > after_event_id]
        return {
            "events": new_events,
            "latest_event_id": self.next_event_id - 1,
        }

class CollaborationHTTPServerBase(HTTPServer):
    """
    HTTPServer with model
    """

    def __init__(self,server_address: tuple[str, int],request_handler_class: type[BaseHTTPRequestHandler],model: AppModel,) -> None:
        super().__init__(server_address, request_handler_class)
        self.model = model

class CollaborationRequestHandler(BaseHTTPRequestHandler):
    """Handle GET and POST requests for the collaboration server."""

    def get_model(self) -> AppModel:
        """
        Return the server model 
        """
        typed_server = cast(CollaborationHTTPServerBase, self.server)
        return typed_server.model

    def log_message(self, format: str, *args: object) -> None:
        """Silence the default request logging."""
        return

    def send_json(self, status_code: int, data: dict[str, Any]) -> None:
        """Send a JSON response back to the client."""
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        """Allow browser fetch() requests from local frontend files."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def read_json_body(self) -> dict[str, Any]:
        """Read and decode a JSON object from the request body."""
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        if raw_body == b"":
            return {}

        decoded = json.loads(raw_body.decode("utf-8"))
        return cast(dict[str, Any], decoded)

    def do_GET(self) -> None:
        """Handle GET routes."""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        model = self.get_model()

        try:
            if path == "/health":
                self.send_json(200, {"status": "ok"})
                return

            if path == "/state":
                self.send_json(200, model.get_state())
                return

            if path == "/updates":
                after_text = query.get("after", ["0"])[0]
                after_event_id = int(after_text)
                self.send_json(200, model.get_updates(after_event_id))
                return

            self.send_json(404, {"error": "route not found"})
        except Exception as error:
            self.send_json(400, {"error": str(error)})

    def do_POST(self) -> None:

        parsed = urlparse(self.path)
        path = parsed.path
        model = self.get_model()

        try:
            payload = self.read_json_body()

            if path == "/user":
                user = model.register_user(payload)
                self.send_json(200, {"ok": True, "user": user})
                return

            if path == "/chat":
                message = model.add_message(payload)
                self.send_json(200, {"ok": True, "message": message})
                return

            if path == "/stroke":
                stroke = model.add_stroke(payload)
                self.send_json(200, {"ok": True, "stroke": stroke})
                return

            if path == "/clear":
                clear_info = model.clear_canvas(payload)
                self.send_json(200, {"ok": True, "clear": clear_info})
                return

            self.send_json(404, {"error": "route not found"})
        except Exception as error:
            self.send_json(400, {"error": str(error)})

class CollaborationHTTPServer:

    def __init__(self, host: str = "127.0.0.1", port: int = 8000, save_file: str = "collab_state.json") -> None:
        self.model = AppModel(save_file=save_file)
        self.httpd = CollaborationHTTPServerBase((host, port), CollaborationRequestHandler, self.model)

    @property
    def host(self) -> str:
        return str(self.httpd.server_address[0])

    @property
    def port(self) -> int:
        return int(self.httpd.server_address[1])

    def serve_forever(self) -> None:
        """Start serving requests in the current process."""
        self.httpd.serve_forever()

    def shutdown(self) -> None:
        """Stop the server cleanly."""
        self.httpd.shutdown()
        self.httpd.server_close()

def main() -> None:

    server = CollaborationHTTPServer()
    print(f"Server running on http://{server.host}:{server.port}")
    print("Use Ctrl+C to stop the server.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopping...")
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()

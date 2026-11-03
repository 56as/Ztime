"""Local Ztime design review. Start with python serve.py."""
import argparse
import json
import os
import re
import sys
import threading
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=41875)
parser.add_argument("--no-browser", action="store_true")
parser.add_argument("--notes", type=Path, default=ROOT / "review-notes.json")
args = parser.parse_args()
origin = f"http://127.0.0.1:{args.port}"
board = r"((desktop|mobile)-((home|week)(-edit|-detail-(writer|browser|reader|notes))?|devices|settings)|desktop-behavior|desktop-pair-(invite|request)|mobile-pair-(scan|confirm|wait|success|refused|timeout))"
write_lock = threading.Lock()


def read_notes():
    if not args.notes.exists():
        return []
    return json.loads(args.notes.read_text(encoding="utf-8"))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *values):
        if sys.stderr is not None:
            super().log_message(format, *values)

    def reply(self, status, payload, mime="application/json"):
        data = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.headers.get("Host") != origin[7:]:
            return self.reply(403, {})
        route = urlsplit(self.path).path
        if route == "/api/identity":
            return self.reply(200, {"app": "ztime-design-review"})
        if route == "/api/notes":
            return self.reply(200, read_notes())
        name = route[1:] or "index.html"
        if name not in {"index.html", "review.css", "review.js", "boards/style.css", "boards/app-icons.svg", "boards/brand-icon.png", "boards/behavior.js", "boards/behavior.css"} and not re.fullmatch(r"reference/[0-9]+\.[0-9]+\.[0-9]+/((day|week|month|year)(-report)?|report|behavior|devices|settings)\.png", name) and not re.fullmatch(r"boards/rank-icons/(chatgpt|chrome|weixin|code|excel|word|rustdesk|tailscale|taskmgr|photos|qq|alipay|bilibili|meituan|tailscale-phone)\.png", name) and not re.fullmatch("boards/" + board + r"\.html", name):
            return self.reply(404, {})
        file = ROOT / name
        mime = {".js": "text/javascript", ".html": "text/html; charset=utf-8", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml"}
        self.reply(200, file.read_bytes(), mime[file.suffix])

    def do_POST(self):
        if self.headers.get("Host") != origin[7:] or self.headers.get("Origin") != origin or self.path != "/api/notes":
            return self.reply(403, {})
        with write_lock:
            self.save_note()

    def save_note(self):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 32768:
                return self.reply(413, {})
            data = json.loads(self.rfile.read(size))
            notes = read_notes()
            text = data["text"].strip()
            if not 0 < len(text) <= 2000:
                raise ValueError()
            if "id" in data:
                note = next((n for n in notes if n["id"] == data["id"]), None)
                if not note or note["version"] != data.get("version"):
                    return self.reply(409, {"error": "批注有更新，请刷新后重试"})
                if not isinstance(data["resolved"], bool):
                    raise ValueError()
                note["resolved"] = data["resolved"]
            else:
                if not re.fullmatch(board, data["board"]):
                    raise ValueError()
                note = {k: data[k] for k in ("board", "size", "selector", "label", "x", "y")}
                note["flow"] = str(data.get("flow", ""))[:1000]
                if not all(isinstance(note[k], str) and 0 < len(note[k]) < 4096 for k in ("size", "selector", "label")):
                    raise ValueError()
                if not all(isinstance(note[k], (float, int)) and 0 <= note[k] <= 1 for k in ("x", "y")):
                    raise ValueError()
                note.update(id=max((n["id"] for n in notes), default=0)+1, resolved=False, version=0)
                notes.append(note)
            if data.get("kind", "UI") not in ("UI", "UX"):
                raise ValueError()
            if "trial" in data:
                trial = data["trial"]
                if not isinstance(trial, dict) or not isinstance(trial.get("copy"), str) or not 0 < len(trial["copy"].strip()) <= 300:
                    raise ValueError()
                size = trial.get("size")
                if size is not None and (type(size) is not int or not 8 <= size <= 80):
                    raise ValueError()
                note["trial"] = {"copy": trial["copy"], "size": size}
            note["kind"] = data.get("kind", "UI")
            note.update(text=text, updated=datetime.now(timezone.utc).isoformat(), version=note["version"]+1)
            temp = args.notes.with_suffix(".tmp")
            temp.write_text(json.dumps(notes, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
            os.replace(temp, args.notes)
            self.reply(200, note)
        except (ValueError, TypeError, KeyError, AttributeError):
            self.reply(400, {"error": "请检查批注内容"})
        except OSError:
            self.reply(500, {"error": "写入批注文件失败，请检查文件权限"})


if __name__ == "__main__":
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError:
        with urllib.request.urlopen(origin + "/api/identity", timeout=2) as response:
            if json.load(response).get("app") != "ztime-design-review":
                raise RuntimeError("设计稿端口已被占用")
    else:
        if not args.no_browser:
            webbrowser.open(origin)
        server.serve_forever()
    if not args.no_browser:
        webbrowser.open(origin)

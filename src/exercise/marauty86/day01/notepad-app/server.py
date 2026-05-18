import http.server
import socketserver
import json
import sqlite3
import os
from datetime import datetime

PORT = 8001
DB_FILE = "notes.db"
STATIC_DIR = "static"

# Initialize Database
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

class NotepadHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/notes/":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM notes ORDER BY created_at DESC")
            notes = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            self.wfile.write(json.dumps(notes).encode())
        elif self.path.startswith("/notes/"):
            try:
                note_id = int(self.path.split("/")[-1])
                conn = sqlite3.connect(DB_FILE)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
                row = cursor.fetchone()
                conn.close()
                
                if row:
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(dict(row)).encode())
                else:
                    self.send_error(404, "Note not found")
            except ValueError:
                self.send_error(400, "Invalid Note ID")
        else:
            # Serve static files
            if self.path == "/":
                self.path = "/index.html"
            
            original_path = self.path
            self.path = STATIC_DIR + original_path
            return super().do_GET()

    def do_POST(self):
        if self.path == "/notes/":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            title = data.get("title", "제목 없음")
            content = data.get("content", "")
            
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("INSERT INTO notes (title, content) VALUES (?, ?)", (title, content))
            note_id = cursor.lastrowid
            conn.commit()
            
            cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
            conn.row_factory = sqlite3.Row
            new_note = dict(cursor.fetchone())
            conn.close()
            
            self.send_response(201)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(new_note).encode())

    def do_PUT(self):
        if self.path.startswith("/notes/"):
            note_id = int(self.path.split("/")[-1])
            content_length = int(self.headers['Content-Length'])
            put_data = self.rfile.read(content_length)
            data = json.loads(put_data)
            
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            
            if "title" in data:
                cursor.execute("UPDATE notes SET title = ? WHERE id = ?", (data["title"], note_id))
            if "content" in data:
                cursor.execute("UPDATE notes SET content = ? WHERE id = ?", (data["content"], note_id))
            
            conn.commit()
            
            cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
            conn.row_factory = sqlite3.Row
            updated_note = dict(cursor.fetchone())
            conn.close()
            
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(updated_note).encode())

    def do_DELETE(self):
        if self.path.startswith("/notes/"):
            note_id = int(self.path.split("/")[-1])
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
            conn.commit()
            conn.close()
            
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"message": "Note deleted successfully"}).encode())

if __name__ == "__main__":
    init_db()
    print(f"Starting server at http://localhost:{PORT}")
    with socketserver.TCPServer(("", PORT), NotepadHandler) as httpd:
        httpd.serve_forever()

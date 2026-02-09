import http.server
import socketserver
import webbrowser
import os

PORT = 8099
Handler = http.server.SimpleHTTPRequestHandler

print(f"Mira AI Server starting at http://localhost:{PORT}")
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print("Mira is online, Boss!")
    webbrowser.open(f"http://localhost:{PORT}")
    httpd.serve_forever()

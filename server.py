import http.server
import socketserver
import json
import os

PORT = 8000
RESULTADOS_PATH = "./data/resultados.json"

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/guardar":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                datos = json.loads(post_data.decode('utf-8'))
                os.makedirs(os.path.dirname(RESULTADOS_PATH), exist_ok=True)
                with open(RESULTADOS_PATH, "w", encoding="utf-8") as f:
                    json.dump(datos, f, indent=2, ensure_ascii=False)
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_error(404, "Ruta no encontrada")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Servidor activo con guardado automático en: http://localhost:{PORT}")
    httpd.serve_forever()
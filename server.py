import http.server
import socketserver
import subprocess
import json
import os

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/run-python':
            print("Executando simulações Python...")
            try:
                # Executa a suite de testes Python
                result = subprocess.run(["python", "simulations/run_validation_suite.py"], capture_output=True, text=True)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                
                response = {"status": "ok", "stdout": result.stdout, "stderr": result.stderr}
                self.wfile.write(json.dumps(response).encode('utf-8'))
                print("Simulações executadas com sucesso.")
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {"status": "error", "message": str(e)}
                self.wfile.write(json.dumps(response).encode('utf-8'))
                print("Erro ao executar as simulações:", e)
        else:
            self.send_response(404)
            self.end_headers()

# Muda o diretório raiz para servir os arquivos corretamente
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    print(f"Servidor rodando em http://localhost:{PORT}")
    print("Acesse http://localhost:8000/app/index.html para ver a interface e utilizar a comunicação backend Python.")
    httpd.serve_forever()

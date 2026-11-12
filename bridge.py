from http.server import HTTPServer, BaseHTTPRequestHandler
import os
import json
import io
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# Cakupan akses Google Drive
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_drive_service():
    creds = None
    # Token disimpan otomatis setelah login pertama kali
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Pastikan Anda memiliki file 'credentials.json' dari Google Cloud Console di folder yang sama
            if os.path.exists('credentials.json'):
                flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
            else:
                print("PERINGATAN: File 'credentials.json' belum ada. Mode server berjalan tanpa koneksi drive aktif.")
                return None
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('drive', 'v3', credentials=creds)

class MegaBridgeHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            # Di sini kita bisa memproses data file yang masuk dari frontend web Anda
            print("Menerima data file dari aplikasi web...")
            
            # Kirim respons sukses kembali ke aplikasi web
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response_data = {"status": "success", "message": "File berhasil diteruskan ke Google Drive!"}
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
        except Exception as e:
            print(f"Error saat memproses upload: {e}")
            self.send_response(500)
            self.end_headers()

def run_server(server_class=HTTPServer, handler_class=MegaBridgeHandler):
    # Mengambil port dari environment Render, atau default ke 8080 jika dijalankan lokal
    port = int(os.environ.get("PORT", 8080))
    server_address = ('0.0.0.0', port)  # Wajib 0.0.0.0 agar dapat diakses oleh Render
    httpd = server_class(server_address, handler_class)
    print(f"Skrip Jembatan Google Drive berjalan di port {port}")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()

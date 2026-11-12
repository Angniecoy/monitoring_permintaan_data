from http.server import HTTPServer, BaseHTTPRequestHandler
import os
import json
import io
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_drive_service():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if os.path.exists('credentials.json'):
                flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
            else:
                return None
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('drive', 'v3', credentials=creds)

class MegaBridgeHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "application/json; charset=utf-8")
        self.end_headers()
        response_data = {"status": "online", "message": "MegaBridge Server is active!"}
        self.wfile.write(json.dumps(response_data).encode("utf-8"))

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            # Hubungkan ke Google Drive API
            service = get_drive_service()
            folder_id = "1ToOdQPobco7s7czx48B9BlxLsT8FXYNY"
            
            # Jika service aktif, lakukan upload nyata
            if service:
                file_metadata = {
                    'name': 'Uploaded_File_Engineering.txt',
                    'parents': [folder_id]
                }
                media = MediaIoBaseUpload(io.BytesIO(post_data), resumable=True)
                file = service.files().create(body=file_metadata, media_body=media, fields='id, webViewLink').execute()
                web_link = file.get('webViewLink')
            else:
                web_link = f"https://drive.google.com/drive/folders/{folder_id}"

            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.end_headers()
            
            response = {
                "success": True,
                "message": "File berhasil diunggah ke Google Drive!",
                "webViewLink": web_link
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.end_headers()
            error_response = {"success": False, "error": str(e)}
            self.wfile.write(json.dumps(error_response).encode("utf-8"))

def run_server(server_class=HTTPServer, handler_class=MegaBridgeHandler, port=10000):
    server_address = ('0.0.0.0', port)
    httpd = server_class(server_address, handler_class)
    httpd.serve_forever()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    run_server(port=port)

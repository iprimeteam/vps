import argparse
import json
from urllib.parse import parse_qs, urlparse
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
BASE_DIR = Path(__file__).resolve().parent
CLIENT_SECRET_FILE = BASE_DIR / "google_client_secret.json"
TOKEN_FILE = BASE_DIR / "google_token.json"


def load_credentials() -> Credentials:
    creds = None

    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    elif not creds or not creds.valid:
        if not CLIENT_SECRET_FILE.exists():
            raise FileNotFoundError(
                f"File OAuth client tidak ditemukan: {CLIENT_SECRET_FILE}"
            )

        flow = InstalledAppFlow.from_client_secrets_file(
            str(CLIENT_SECRET_FILE), SCOPES
        )
        try:
            creds = flow.run_local_server(port=0, open_browser=False)
        except Exception:
            auth_url, _ = flow.authorization_url(
                access_type="offline",
                include_granted_scopes="true",
                prompt="consent",
            )
            print("Buka URL ini di browser lalu login:")
            print(auth_url)
            redirected_url = input(
                "Paste URL callback lengkap setelah login Google: "
            ).strip()
            parsed = urlparse(redirected_url)
            if not parse_qs(parsed.query).get("code"):
                raise ValueError("URL callback tidak mengandung code OAuth.")
            flow.fetch_token(authorization_response=redirected_url)
            creds = flow.credentials
        TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")

    return creds


def build_service():
    creds = load_credentials()
    return build("drive", "v3", credentials=creds)


def cmd_whoami(service):
    about = service.about().get(fields="user,storageQuota").execute()
    print(json.dumps(about, indent=2, ensure_ascii=False))


def cmd_list(service, limit: int):
    result = (
        service.files()
        .list(
            pageSize=limit,
            fields="files(id,name,mimeType,modifiedTime,size)",
            orderBy="modifiedTime desc",
        )
        .execute()
    )
    print(json.dumps(result.get("files", []), indent=2, ensure_ascii=False))


def cmd_upload(service, file_path: str, parent_id: str | None):
    local_file = Path(file_path).resolve()
    if not local_file.exists():
        raise FileNotFoundError(f"File tidak ditemukan: {local_file}")

    metadata = {"name": local_file.name}
    if parent_id:
        metadata["parents"] = [parent_id]

    media = MediaFileUpload(str(local_file), resumable=True)
    uploaded = (
        service.files()
        .create(body=metadata, media_body=media, fields="id,name,webViewLink")
        .execute()
    )
    print(json.dumps(uploaded, indent=2, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(
        description="Uji coba Google Drive pribadi dengan OAuth."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("whoami", help="Tampilkan info akun dan quota.")

    list_parser = subparsers.add_parser("list", help="List file terbaru.")
    list_parser.add_argument("--limit", type=int, default=10)

    upload_parser = subparsers.add_parser("upload", help="Upload satu file.")
    upload_parser.add_argument("file")
    upload_parser.add_argument("--parent-id", default=None)

    args = parser.parse_args()
    service = build_service()

    if args.command == "whoami":
        cmd_whoami(service)
    elif args.command == "list":
        cmd_list(service, args.limit)
    elif args.command == "upload":
        cmd_upload(service, args.file, args.parent_id)


if __name__ == "__main__":
    main()

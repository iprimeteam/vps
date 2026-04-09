# Google Drive Test

Script ini dipakai untuk uji coba Google Drive pribadi dengan OAuth desktop app.

## 1. Siapkan kredensial

1. Buka Google Cloud Console.
2. Enable `Google Drive API`.
3. Buat `OAuth client ID`.
4. Pilih tipe `Desktop app`.
5. Download file JSON.
6. Simpan file itu di folder ini dengan nama:

`google_client_secret.json`

## 2. Install dependency

```powershell
python -m pip install -r requirements-gdrive.txt
```

## 3. Login dan cek akun

```powershell
python gdrive_test.py whoami
```

Saat pertama dijalankan, browser akan terbuka untuk login Google dan memberi izin.

Token login akan disimpan ke:

`google_token.json`

## 4. List file

```powershell
python gdrive_test.py list --limit 10
```

## 5. Upload file

```powershell
python gdrive_test.py upload "D:\path\file.txt"
```

Kalau mau upload ke folder tertentu:

```powershell
python gdrive_test.py upload "D:\path\file.txt" --parent-id FOLDER_ID
```

## Catatan

- Scope yang dipakai adalah `drive.file`, jadi script hanya bisa akses file yang dibuat atau dibuka oleh app ini.
- Kalau mau akses daftar file yang lebih luas, scope bisa diubah ke `https://www.googleapis.com/auth/drive`.

# Backend (Django + uv)

## Yêu cầu

- Python (theo `pyproject.toml`)
- `uv`
- `ffmpeg` có trong `PATH`

## Cài đặt

```bash
uv sync
```

## Chạy migration

```bash
uv run python manage.py migrate
```

## Chạy server

```bash
uv run python manage.py runserver 0.0.0.0:8000
```

## Chạy test

```bash
uv run python manage.py test pipeline
```

## API

- `POST /api/jobs/upload/` (multipart, field: `file`)
- `GET /api/jobs/<job_id>/`

## Ghi chú hiện tại

- Pipeline ASR/TSD đang dùng mock inference để debug flow upload/extract/polling trên máy không GPU.
- Nhánh video dùng `ffmpeg` để tách audio mono 16kHz.

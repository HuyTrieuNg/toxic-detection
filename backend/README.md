# Backend (Django + uv)

## Yêu cầu

- Python (theo `pyproject.toml`)
- `uv`
- `ffmpeg` có trong `PATH`
- 3 model local phải nằm đúng tại `backend/ai-model`

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
- `POST /api/text/analyze/` (JSON, field: `text`, optional `include_spans`)

## Ghi chú hiện tại

- Pipeline hiện load local model khi app khởi động, audio/video đều được chuẩn hóa về WAV mono 16kHz trước khi chunk 12s overlap 2s.
- Text comment đi qua binary model trước, nếu toxic mới gọi TSD để lấy span chi tiết.

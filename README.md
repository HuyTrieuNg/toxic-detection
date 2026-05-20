# Toxic Detection (Django + React)

Web app upload audio/video, tách audio từ video bằng ffmpeg, chạy pipeline ASR/TSD và hiển thị transcript có tô màu từ toxic.

## Stack

- Backend: Django (`uv`)
- Frontend: React + Vite (`pnpm`)
- UI: Tailwind CSS
- Data fetching: React Query

## Chạy nhanh

### 1) Backend

```bash
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py runserver 0.0.0.0:8000
```

### 2) Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

## API

- `POST /api/jobs/upload/`
- `GET /api/jobs/<job_id>/`
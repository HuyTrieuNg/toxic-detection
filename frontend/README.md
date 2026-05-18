# Frontend (React + Vite + pnpm)

## Yêu cầu

- Node.js
- `pnpm`

## Cài đặt

```bash
pnpm install
```

## Chạy dev

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Cấu hình backend URL

Mặc định frontend gọi backend tại `http://127.0.0.1:8000/api`.

Bạn có thể đổi qua biến môi trường:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## Chức năng hiện có

- Upload audio/video
- Polling trạng thái xử lý với React Query
- Hiển thị transcript
- Highlight các từ toxic (theo `toxic_spans` từ backend)

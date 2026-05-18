# Requirement

## 1. Tạo cho tôi một trang web có chức năng

- Upload video/audio lên
- Tách audio nếu là video (sử dụng ffmpeg local)
- Nạp model phoWhisper đã finetune (.\backend\notebook\asr-fine-tuning-phowhisper-base-tr-n-vitosa.ipynb) và chuyển audio thành văn bản.
- Đưa văn bản vào model PhoBERT đã finetune (.\backend\notebook\tsd-fine-tuning-phobert-base-v2.ipynb) để xác định từ toxic.
- Đưa ra kết quả cho người dùng là văn bản và đổi màu từ bị coi là toxic

## 2. Sử dụng django cho backend, React cho front end

- Tôi đã khởi tạo phần template
- Sử dụng react query để hiển thị phần đang xử lý khi upload file lên
- Sử dụng tailwind cho giao diện

### Lưu ý: Thiết bị hiện tại không có GPU nên không thể chạy các model, tôi chỉ có thể debug phần upload video/audio và tách audio

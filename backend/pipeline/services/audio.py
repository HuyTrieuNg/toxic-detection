from pathlib import Path
import shutil
import subprocess


AUDIO_EXTENSIONS = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'}
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}


class UnsupportedMediaError(ValueError):
    pass


def infer_media_type(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension in AUDIO_EXTENSIONS:
        return 'audio'
    if extension in VIDEO_EXTENSIONS:
        return 'video'
    raise UnsupportedMediaError(f'Unsupported file extension: {extension or "(missing)"}')


def extract_audio(input_path: str, media_type: str, output_dir: Path) -> tuple[Path, bool]:
    source = Path(input_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    if media_type == 'audio':
        copied_path = output_dir / f'{source.stem}_normalized{source.suffix.lower()}'
        shutil.copy2(source, copied_path)
        return copied_path, True

    if media_type == 'video':
        extracted_path = output_dir / f'{source.stem}_extracted.wav'
        command = [
            'ffmpeg',
            '-y',
            '-i',
            str(source),
            '-vn',
            '-ac',
            '1',
            '-ar',
            '16000',
            '-f',
            'wav',
            str(extracted_path),
        ]
        try:
            subprocess.run(
                command, check=True, capture_output=True, text=True, encoding='utf-8', errors='replace'
            )
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.strip() if exc.stderr else 'Unknown ffmpeg error'
            raise RuntimeError(f'Failed to extract audio with ffmpeg: {stderr}') from exc
        return extracted_path, True

    raise UnsupportedMediaError(f'Unsupported media type: {media_type}')

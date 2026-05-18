from pathlib import Path
import shutil
import subprocess
import wave

import numpy as np


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

    if media_type not in {'audio', 'video'}:
        raise UnsupportedMediaError(f'Unsupported media type: {media_type}')

    normalized_path = output_dir / f'{source.stem}_normalized.wav'
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
        '-acodec',
        'pcm_s16le',
        str(normalized_path),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True, encoding='utf-8', errors='replace')
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() if exc.stderr else 'Unknown ffmpeg error'
        raise RuntimeError(f'Failed to normalize audio with ffmpeg: {stderr}') from exc

    return normalized_path, True


def load_wav_audio(audio_path: str) -> tuple[np.ndarray, int]:
    with wave.open(audio_path, 'rb') as wav_file:
        sample_rate = wav_file.getframerate()
        frame_count = wav_file.getnframes()
        raw_audio = wav_file.readframes(frame_count)

    audio = np.frombuffer(raw_audio, dtype=np.int16).astype(np.float32) / 32768.0
    return audio, sample_rate


def chunk_audio(audio: np.ndarray, sample_rate: int, chunk_seconds: int = 12, overlap_seconds: int = 2):
    chunk_size = int(chunk_seconds * sample_rate)
    overlap_size = int(overlap_seconds * sample_rate)
    hop_size = max(1, chunk_size - overlap_size)

    if audio.size == 0:
        return []

    chunks = []
    start = 0
    total_samples = int(audio.shape[0])

    while start < total_samples:
        end = min(total_samples, start + chunk_size)
        chunk_audio = audio[start:end]
        chunks.append(
            {
                'start_sample': start,
                'end_sample': end,
                'start_seconds': start / sample_rate,
                'end_seconds': end / sample_rate,
                'audio': chunk_audio,
            }
        )

        if end >= total_samples:
            break
        start += hop_size

    return chunks

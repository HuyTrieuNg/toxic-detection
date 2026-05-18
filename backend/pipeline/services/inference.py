from pathlib import Path
import re


MOCK_TOXIC_WORDS = {
    'ngu',
    'đần',
    'đần độn',
    'cút',
    'khùng',
    'điên',
    'chết tiệt',
}


def transcribe_audio(audio_path: str) -> str:
    base_text = Path(audio_path).stem.replace('_', ' ').replace('-', ' ').strip()
    if not base_text:
        return 'xin chao day la ban ghi thu nghiem'
    return base_text.lower()


def detect_toxic_spans(text: str) -> list[dict]:
    spans: list[dict] = []
    for match in re.finditer(r'\S+', text):
        token = match.group(0)
        normalized_token = token.lower().strip('.,!?;:\"\'()[]{}')
        if normalized_token in MOCK_TOXIC_WORDS:
            spans.append(
                {
                    'word': token,
                    'start': match.start(),
                    'end': match.end(),
                    'label': 'Toxic',
                }
            )
    return spans

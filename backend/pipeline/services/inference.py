import re
import sys
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import torch
from django.conf import settings
from transformers import (
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    AutoTokenizer,
    WhisperForConditionalGeneration,
    WhisperProcessor,
)

from pipeline.services.audio import chunk_audio, load_wav_audio


MODEL_ROOT = settings.BASE_DIR / 'ai-model'
ASR_MODEL_DIR = MODEL_ROOT / 'phowhisper_ASR'
BINARY_MODEL_DIR = MODEL_ROOT / 'Phobert_binary'
TSD_MODEL_DIR = MODEL_ROOT / 'phobert_TSD'


@dataclass(frozen=True)
class ModelBundle:
    device: torch.device
    asr_processor: WhisperProcessor
    asr_model: WhisperForConditionalGeneration
    binary_tokenizer: Any
    binary_model: AutoModelForSequenceClassification
    tsd_tokenizer: Any
    tsd_model: AutoModelForTokenClassification


@lru_cache(maxsize=1)
def load_model_bundle() -> ModelBundle:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    asr_processor = WhisperProcessor.from_pretrained(ASR_MODEL_DIR, local_files_only=True)
    asr_model = WhisperForConditionalGeneration.from_pretrained(ASR_MODEL_DIR, local_files_only=True)
    asr_model.to(device)
    asr_model.eval()

    binary_tokenizer = AutoTokenizer.from_pretrained(BINARY_MODEL_DIR, local_files_only=True)
    binary_model = AutoModelForSequenceClassification.from_pretrained(BINARY_MODEL_DIR, local_files_only=True)
    binary_model.to(device)
    binary_model.eval()

    tsd_tokenizer = AutoTokenizer.from_pretrained(TSD_MODEL_DIR, local_files_only=True)
    tsd_model = AutoModelForTokenClassification.from_pretrained(TSD_MODEL_DIR, local_files_only=True)
    tsd_model.to(device)
    tsd_model.eval()

    return ModelBundle(
        device=device,
        asr_processor=asr_processor,
        asr_model=asr_model,
        binary_tokenizer=binary_tokenizer,
        binary_model=binary_model,
        tsd_tokenizer=tsd_tokenizer,
        tsd_model=tsd_model,
    )


def _ensure_models_loaded() -> ModelBundle:
    return load_model_bundle()


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize('NFKC', text or '')
    
    # Preprocessing identical logic to your model training logic: 
    # Remove emoji and strange icon punctuation 
    normalized = re.sub(r'[\U00010000-\U0010ffff]', '', normalized)
    
    # Remove specific punctuation characters to match training data
    normalized = re.sub(r'[\.,!?;:\-()\[\]{}<>\'\"]', '', normalized)
    
    # Normalize spaces and lowercase
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    normalized = normalized.lower()
    
    return normalized


def merge_chunk_transcripts(transcripts: list[str]) -> str:
    if not transcripts:
        return ''

    merged_words: list[str] = []
    for transcript in transcripts:
        words = transcript.split()
        if not merged_words:
            merged_words.extend(words)
            continue

        max_overlap = min(len(merged_words), len(words), 24)
        overlap = 0
        for candidate in range(max_overlap, 0, -1):
            if merged_words[-candidate:] == words[:candidate]:
                overlap = candidate
                break

        merged_words.extend(words[overlap:])

    return ' '.join(merged_words).strip()


def transcribe_audio(audio_path: str) -> str:
    bundle = _ensure_models_loaded()
    audio_array, sample_rate = load_wav_audio(audio_path)
    chunks = chunk_audio(audio_array, sample_rate, chunk_seconds=12, overlap_seconds=2)

    if not chunks:
        return ''

    forced_decoder_ids = bundle.asr_processor.get_decoder_prompt_ids(language='vi', task='transcribe')
    transcripts: list[str] = []

    for chunk in chunks:
        inputs = bundle.asr_processor(
            chunk['audio'],
            sampling_rate=sample_rate,
            return_tensors='pt',
        )
        input_features = inputs.input_features.to(bundle.device)

        with torch.no_grad():
            generated_ids = bundle.asr_model.generate(
                input_features=input_features,
                forced_decoder_ids=forced_decoder_ids,
            )

        chunk_text = bundle.asr_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        chunk_text = normalize_text(chunk_text)
        if chunk_text:
            transcripts.append(chunk_text)

    return merge_chunk_transcripts(transcripts)


def analyze_text_binary(text: str) -> dict:
    bundle = _ensure_models_loaded()
    processed_text = normalize_text(text)

    if not processed_text:
        return {
            'input_text': text,
            'processed_text': processed_text,
            'is_toxic': False,
            'label': 'NONE',
            'label_id': 0,
            'confidence': 0.0,
            'toxic_probability': 0.0,
        }

    encoded = bundle.binary_tokenizer(
        processed_text,
        return_tensors='pt',
        truncation=True,
        max_length=256,
        padding=True,
    )
    encoded = {key: value.to(bundle.device) for key, value in encoded.items()}

    with torch.no_grad():
        logits = bundle.binary_model(**encoded).logits
        probabilities = torch.softmax(logits, dim=-1).squeeze(0)

    label_id = int(torch.argmax(probabilities).item())
    label = 'TOXIC' if label_id == 1 else 'NONE'
    toxic_probability = float(probabilities[1].item() if probabilities.shape[-1] > 1 else 0.0)
    confidence = float(probabilities[label_id].item())

    return {
        'input_text': text,
        'processed_text': processed_text,
        'is_toxic': label_id == 1,
        'label': label,
        'label_id': label_id,
        'confidence': confidence,
        'toxic_probability': toxic_probability,
    }


@dataclass(frozen=True)
class WordSpan:
    word: str
    start: int
    end: int


def _extract_word_spans(text: str) -> list[WordSpan]:
    spans: list[WordSpan] = []
    for match in re.finditer(r'\S+', text):
        spans.append(WordSpan(word=match.group(0), start=match.start(), end=match.end()))
    return spans


def _run_tsd_window(bundle: ModelBundle, text: str, word_spans: list[WordSpan]) -> list[dict]:
    if not word_spans:
        return []

    input_ids = [bundle.tsd_tokenizer.cls_token_id]
    word_token_ranges: list[tuple[int, int]] = []

    for word_span in word_spans:
        tokens = bundle.tsd_tokenizer.tokenize(word_span.word)
        if not tokens:
            tokens = [bundle.tsd_tokenizer.unk_token]
        token_ids = bundle.tsd_tokenizer.convert_tokens_to_ids(tokens)
        start_index = len(input_ids)
        input_ids.extend(token_ids)
        end_index = len(input_ids)
        word_token_ranges.append((start_index, end_index))

    input_ids.append(bundle.tsd_tokenizer.sep_token_id)
    attention_mask = [1] * len(input_ids)

    max_length = 256
    if len(input_ids) > max_length:
        input_ids = input_ids[:max_length]
        attention_mask = attention_mask[:max_length]

    pad_length = max_length - len(input_ids)
    if pad_length > 0:
        input_ids += [bundle.tsd_tokenizer.pad_token_id] * pad_length
        attention_mask += [0] * pad_length

    input_tensor = torch.tensor([input_ids], device=bundle.device)
    mask_tensor = torch.tensor([attention_mask], device=bundle.device)

    with torch.no_grad():
        logits = bundle.tsd_model(input_ids=input_tensor, attention_mask=mask_tensor).logits

    token_scores = torch.softmax(logits.squeeze(0), dim=-1)

    toxic_words: list[dict] = []
    for index, word_span in enumerate(word_spans):
        start_index, end_index = word_token_ranges[index]
        start_index = min(start_index, token_scores.shape[0])
        end_index = min(end_index, token_scores.shape[0])
        if start_index >= end_index:
            continue

        window_scores = token_scores[start_index:end_index]
        averaged_scores = window_scores.mean(dim=0)
        label_id = int(torch.argmax(averaged_scores).item())
        toxic_probability = float(max(averaged_scores[1].item(), averaged_scores[2].item()))

        if label_id in {1, 2} or toxic_probability >= 0.5:
            toxic_words.append(
                {
                    'start': word_span.start,
                    'end': word_span.end,
                    'word': word_span.word,
                    'score': round(toxic_probability, 4),
                }
            )

    if not toxic_words:
        return []

    spans: list[dict] = []
    current_start = toxic_words[0]['start']
    current_end = toxic_words[0]['end']
    current_scores = [toxic_words[0]['score']]

    for word in toxic_words[1:]:
        if word['start'] <= current_end + 1:
            current_end = max(current_end, word['end'])
            current_scores.append(word['score'])
            continue

        spans.append(
            {
                'word': text[current_start:current_end],
                'start': current_start,
                'end': current_end,
                'label': 'Toxic',
                'score': round(sum(current_scores) / len(current_scores), 4),
            }
        )
        current_start = word['start']
        current_end = word['end']
        current_scores = [word['score']]

    spans.append(
        {
            'word': text[current_start:current_end],
            'start': current_start,
            'end': current_end,
            'label': 'Toxic',
            'score': round(sum(current_scores) / len(current_scores), 4),
        }
    )

    return spans


def detect_toxic_spans(text: str) -> list[dict]:
    bundle = _ensure_models_loaded()
    processed_text = normalize_text(text)
    if not processed_text:
        return []

    word_spans = _extract_word_spans(processed_text)

    if len(word_spans) <= 180:
        return _run_tsd_window(bundle, processed_text, word_spans)

    all_spans: list[dict] = []
    window_size = 160
    overlap = 30
    start = 0

    while start < len(word_spans):
        end = min(len(word_spans), start + window_size)
        window_word_spans = word_spans[start:end]
        local_spans = _run_tsd_window(bundle, processed_text, window_word_spans)
        for span in local_spans:
            all_spans.append(
                {
                    'word': processed_text[span['start']:span['end']],
                    'start': span['start'],
                    'end': span['end'],
                    'label': span['label'],
                    'score': span.get('score', 0.0),
                }
            )

        if end >= len(word_spans):
            break
        start = max(end - overlap, start + 1)

    if not all_spans:
        return []

    merged: list[dict] = [all_spans[0]]
    for span in all_spans[1:]:
        previous = merged[-1]
        if span['start'] <= previous['end'] + 1:
            previous['end'] = max(previous['end'], span['end'])
            previous['word'] = processed_text[previous['start']:previous['end']]
            previous['score'] = round((previous.get('score', 0.0) + span.get('score', 0.0)) / 2, 4)
            continue
        merged.append(span)

    return merged


def analyze_text(text: str, include_spans: bool = False) -> dict:
    binary_result = analyze_text_binary(text)
    spans = detect_toxic_spans(text) if include_spans else []

    return {
        **binary_result,
        'toxic_spans': spans,
        'has_toxic_spans': bool(spans),
    }


def analyze_media_file(audio_path: str) -> dict:
    transcript = transcribe_audio(audio_path)
    
    # Bỏ qua bước phân loại nhị phân đối với Media, gọi thẳng TSD (Span detection)
    toxic_spans = detect_toxic_spans(transcript)

    return {
        'transcript': transcript,
        'binary_result': None, # Đã bỏ vòng check binary
        'toxic_spans': toxic_spans,
    }

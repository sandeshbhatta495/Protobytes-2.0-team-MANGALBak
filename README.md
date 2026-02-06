# Nepali Speech-to-Text (STT)

A speech-to-text system for the Nepali language using OpenAI's Whisper model and DistilBERT for Nepali NLP tasks.

## Overview

This project provides:
- **Speech Recognition**: Transcribe Nepali audio to text using OpenAI Whisper
- **Nepali Language Model**: DistilBERT base model fine-tuned for Nepali (`Sakonii/distilbert-base-nepali`)

## Models Used

| Model | Purpose | Source |
|-------|---------|--------|
| `openai/whisper-small` | Automatic Speech Recognition | Hugging Face |
| `Sakonii/distilbert-base-nepali` | Nepali NLP (Fill-Mask) | Hugging Face |

## Requirements

### Dependencies

```bash
pip install transformers torch soundfile numpy gradio
```

### System Requirements

- **FFmpeg**: Required for audio conversion
  ```bash
  # Ubuntu/Debian
  apt-get install ffmpeg
  
  # Windows (via chocolatey)
  choco install ffmpeg
  ```
- **GPU**: CUDA-compatible GPU recommended for faster inference
- **Python**: 3.8+

## Usage

### Speech-to-Text Transcription

```python
import soundfile as sf
import torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration

# Load model
model_id = "openai/whisper-small"
processor = WhisperProcessor.from_pretrained(model_id)
model = WhisperForConditionalGeneration.from_pretrained(model_id)

# Use GPU if available
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)

# Load and process audio
audio, sr = sf.read("your_audio.wav", dtype="float32")
input_features = processor(audio, sampling_rate=sr, return_tensors="pt").input_features
input_features = input_features.to(device)

# Generate transcription
predicted_ids = model.generate(input_features)
transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
print(transcription)
```

### Using Pipeline (Simple Method)

```python
from transformers import pipeline

whisper_model = pipeline(
    task="automatic-speech-recognition",
    model="openai/whisper-small",
    device=0  # GPU
)

result = whisper_model({"sampling_rate": 16000, "array": audio})
print(result["text"])
```

### Nepali Language Model (Fill-Mask)

```python
from transformers import pipeline

pipe = pipeline("fill-mask", model="Sakonii/distilbert-base-nepali")
result = pipe("नेपाल एक [MASK] देश हो।")
print(result)
```

## Audio Preprocessing

For best results, convert audio to mono 16kHz WAV format:

```bash
ffmpeg -i input.wav -ar 16000 -ac 1 -c:a pcm_s16le output.wav
```

Or in Python:

```python
import subprocess

command = [
    "ffmpeg", "-i", "input.wav",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "output.wav", "-y"
]
subprocess.run(command, check=True)
```

## Google Colab Integration

The notebook includes support for Google Colab with Drive mounting:

```python
from google.colab import drive
drive.mount('/content/drive')
```

## File Structure

```
Nepali STT/
├── distilbert_base_nepali.ipynb   # Main notebook
└── README.md                       # This file
```

## Notes

- Audio files should be in WAV format (16kHz, mono) for optimal results
- GPU acceleration significantly improves transcription speed
- Hugging Face token may be required for certain models (`huggingface_hub.login()`)

## License

This project uses models from Hugging Face. Please refer to individual model licenses:
- [Whisper](https://huggingface.co/openai/whisper-small) - MIT License
- [DistilBERT Nepali](https://huggingface.co/Sakonii/distilbert-base-nepali) - Apache 2.0

## Acknowledgments

- OpenAI for the Whisper model
- Sakonii for the DistilBERT Nepali model
- Hugging Face Transformers library

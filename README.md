# Sarkari-Sarathi — AI Digital Scribe for Local Government (Nepal)

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-teal.svg)
![Whisper](https://img.shields.io/badge/Whisper-Nepali%20Fine--tuned-orange.svg)
![Tesseract](https://img.shields.io/badge/Tesseract.js-OCR-blue.svg)

**एक AI-संचालित डिजिटल स्क्राइब जसले नेपाली नागरिकहरूलाई सरकारी कागजातहरू सजिलै उत्पन्न गर्न मद्दत गर्दछ।**

*An AI-powered digital scribe helping Nepali citizens easily generate government documents.*

[Features](#-features) • [Quick Start](#-quick-start) • [Installation](#-installation) • [API](#-api-endpoints) • [Contributing](#-contributing)

</div>

---

## Overview

**Sarkari-Sarathi** is a comprehensive document generation system designed for Nepal's local government services. It provides three input methods — voice, handwriting, and keyboard — so that citizens of all literacy levels can fill out official government forms easily.

### What It Does
1. User selects a document type (birth registration, death registration, etc.)
2. Fills in the form using **voice** (Nepali speech recognition), **handwriting** (canvas + OCR), or **keyboard** (with English-to-Nepali transliteration)
3. The system generates a **print-ready PDF** in official government format

## 🎯 Features

### Multi-Modal Input
| Input Method | Description | Technology |
|---|---|---|
| 🎤 **आवाज (Voice)** | Speak in Nepali, get Devanagari text | Fine-tuned Whisper ASR (`amitpant7/Nepali-Automatic-Speech-Recognition`) |
| ✍️ **हस्तलेखन (Handwriting)** | Draw/write on canvas, get recognized text | Tesseract.js OCR (client-side) + Gemini Vision (server fallback) |
| ⌨️ **किबोर्ड (Keyboard)** | Type in English, auto-transliterate to Nepali | Custom rule-based transliteration with 60+ conjunct patterns |

### Supported Government Documents (9 Templates)

| Category | Documents |
|---|---|
| **Civil Registration** | जन्म दर्ता (Birth) · मृत्यु दर्ता (Death) · विवाह दर्ता (Marriage) · सम्बन्धविच्छेद (Divorce) |
| **Certificates** | बसाइसराई प्रमाणपत्र (Migration) · बसोबास प्रमाणपत्र (Residence) |
| **Utilities** | विद्युत जडान (Electricity) · खानेपानी जडान (Water) · बाटो पहुँच (Road Access) |

### Key Highlights
- **No Login Required** — Stateless, session-based operation
- **Elder-Friendly UI** — Simple 3-step guided flow (Select → Fill → Download)
- **Cascading Location Dropdowns** — All 7 provinces, 77 districts, 700+ municipalities
- **Real-time Transliteration** — Type English, see Nepali instantly
- **Grammar Correction** — Rule-based Nepali particle and punctuation normalization
- **Bilingual Fields** — Supports both Nepali and English input where needed
- **Offline ASR** — Works without internet for speech recognition (model cached locally)

## 🛠️ Technology Stack

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** + **Uvicorn** | REST API server |
| **Python 3.11** | Core runtime |
| **HuggingFace Transformers** | ASR model inference |
| **Fine-tuned Nepali Whisper** | Primary speech recognition (`amitpant7/Nepali-Automatic-Speech-Recognition`) |
| **OpenAI Whisper (base)** | Fallback speech recognition |
| **Google Gemini 2.0 Flash** | AI document generation & handwriting recognition |
| **ReportLab** | PDF generation with Nepali font support |
| **PyDub + FFmpeg** | Audio format conversion (via `imageio-ffmpeg`) |
| **Rule-based Grammar** | Nepali text correction (particle attachment, दण्ड punctuation) |

### Frontend
| Technology | Purpose |
|---|---|
| **HTML5 / Tailwind CSS** | Responsive UI |
| **Vanilla JavaScript** | Form logic, transliteration engine |
| **Tesseract.js** | Client-side OCR for handwriting (Nepali + English) |
| **Canvas API** | Free-form handwriting input |
| **MediaRecorder API** | Voice recording from browser |

### AI Models
| Model | Role |
|---|---|
| `amitpant7/Nepali-Automatic-Speech-Recognition` | Primary Nepali ASR (fine-tuned Whisper) |
| `openai/whisper-base` | Fallback ASR |
| `gemini-2.0-flash` | Document generation, handwriting OCR fallback |

## 🏗️ Architecture

```
┌───────────────────────────┐     ┌───────────────────────────┐     ┌────────────────────┐
│        Frontend           │     │         Backend           │     │    External AI     │
│       (Browser)           │◄───►│        (FastAPI)          │◄───►│                    │
│                           │     │                           │     │  Gemini 2.0 Flash  │
│  • Voice Recording        │     │  • /transcribe-audio      │     │  (doc generation)  │
│  • Canvas Handwriting     │     │  • /recognize-handwriting │     │                    │
│  • English→Nepali Translit│     │  • /generate-document     │     └────────────────────┘
│  • Tesseract.js OCR       │     │  • /transliterate         │
│  • Cascading Dropdowns    │     │  • /correct-grammar       │     ┌────────────────────┐
│                           │     │  • /locations             │     │   Local Models     │
│                           │     │  • PDF Generation         │◄───►│                    │
│                           │     │  • Grammar Correction     │     │  Nepali Whisper    │
│                           │     │  • FFmpeg Audio Convert   │     │  Whisper (base)    │
└───────────────────────────┘     └───────────────────────────┘     └────────────────────┘
```

### Processing Pipelines

**Voice Pipeline:**
```
Mic → MediaRecorder (WebM) → /transcribe-audio → FFmpeg (→WAV 16kHz) → Nepali Whisper → Grammar Correction → Field
```

**Handwriting Pipeline:**
```
Canvas Drawing → Preprocessing (crop, binarize, scale) → Tesseract.js OCR → Grammar Correction → Field
                                                           ↓ (fallback)
                                                      /recognize-handwriting → Gemini Vision
```

**Keyboard Pipeline:**
```
English Keystrokes → Real-time Transliteration (60+ conjunct rules) → Nepali Devanagari → Field
```

## 📁 Project Structure

```
Sarkari-Sarathi/
├── backend/
│   ├── main.py                  # FastAPI app — all API endpoints, PDF generation
│   ├── nepali_asr.py            # Nepali ASR module (Whisper fine-tuned + FFmpeg setup)
│   ├── grammar.py               # Rule-based Nepali grammar correction
│   ├── locations.json           # Nepal administrative data (7 provinces, 77 districts, 700+ municipalities)
│   ├── requirements.txt         # Python dependencies
│   ├── .env.config              # Environment variables (Gemini API key)
│   ├── templates/               # 9 document templates (JSON)
│   │   ├── birth_registration.json
│   │   ├── death_registration.json
│   │   ├── marriage_registration.json
│   │   ├── divorce_registration.json
│   │   ├── migration_certificate.json
│   │   ├── residence_certificate.json
│   │   ├── electricity_connection.json
│   │   ├── water_connection.json
│   │   └── road_access.json
│   ├── generated_documents/     # Output PDFs (auto-created)
│   └── static/
│       ├── fonts/               # NotoSansDevanagari font for PDF
│       ├── handwriting/         # Browser handwriting JS modules
│       └── handwriting_model/   # Model config for handwriting
├── frontend/
│   ├── index.html               # Main application UI
│   ├── script.js                # Core logic — transliteration, forms, voice, dropdowns
│   └── tesseract_handwriting.js # Tesseract.js OCR wrapper with preprocessing
├── handwriting_recognition/     # Handwriting model training tools
│   ├── model/                   # BiLSTM+CTC architecture
│   ├── browser/                 # TensorFlow.js inference modules
│   └── tools/                   # Data collection utilities
├── Nepali_speech_to_text/       # ASR training & datasets
│   ├── src/                     # Training scripts
│   ├── notebook/                # Fine-tuning notebooks
│   └── dataset/                 # Training data & preparation scripts
└── README.md
```

## 🚀 Installation

### Prerequisites
- **Python 3.11+**
- **CUDA GPU** (recommended for faster ASR inference; CPU works but slower)
- **Git**

### Quick Start

```bash
# 1. Clone
git clone https://github.com/sandeshbhatta495/Protobytes-2.0-team-MANGALBak.git
cd Protobytes-2.0-team-MANGALBak

# 2. Create virtual environment
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

#if you want to install the latest version of transformers and imageio-ffmpeg, you can use:
#pip install --upgrade transformers imageio-ffmpeg
# 4. Configure Gemini API key
# Create/edit .env.config:
#   GEMINI_API_KEY=your_key_here

# 5. Start server
python main.py

# 6. Open in browser
# http://localhost:8000/app
```

> **Note:** FFmpeg is auto-configured via `imageio-ffmpeg` — no manual install needed. The Nepali Whisper model downloads automatically on first run (~1GB).

### Environment Variables

Create `.env.config` in the `backend/` directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
HOST=0.0.0.0
PORT=8000
```

## 📡 API Endpoints

### Core Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/app` | Serve the frontend application |
| `GET` | `/health` | Health check |
| `POST` | `/transcribe-audio` | Transcribe audio file to Nepali text |
| `POST` | `/transliterate` | Convert English text to Nepali |
| `POST` | `/correct-grammar` | Apply Nepali grammar correction |
| `POST` | `/recognize-handwriting` | Extract text from handwriting image (Gemini Vision) |
| `POST` | `/generate-document` | Generate PDF from form data |
| `GET` | `/download-document/{filename}` | Download generated PDF |

### Data Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/locations` | Nepal administrative location data (cascading dropdowns) |
| `GET` | `/document-types` | List available document templates |
| `GET` | `/template/{type}` | Get form fields for a document type |
| `GET` | `/asr-status` | Check ASR model loading status |

## 💻 Usage

### 3-Step Flow
1. **Select Document** — Choose from 9 government document types
2. **Fill Form** — Use voice, handwriting, or keyboard for each field
3. **Preview & Download** — Review the generated PDF and download

### Tips for Best Results

**Voice Input:**
- Speak clearly in Nepali at normal pace
- Works best with a good microphone
- Short phrases (5–10 seconds) give better accuracy

**Handwriting:**
- Write large, clear Devanagari characters
- Use the full canvas area
- Works best with a stylus/touchscreen

**Keyboard:**
- Type English phonetically (e.g., `namaste` → `नमस्ते`)
- Conjuncts auto-resolve (e.g., `ksha` → `क्ष`, `gya` → `ज्ञ`)

## 🔒 Security & Privacy

- No user accounts or permanent data storage
- Session-based operation — data cleared after download
- Audio files deleted immediately after transcription
- No biometric data retained
- CORS-configured API endpoints

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

### Model Licenses
| Model | License |
|---|---|
| [Nepali ASR](https://huggingface.co/amitpant7/Nepali-Automatic-Speech-Recognition) | Apache 2.0 |
| [OpenAI Whisper](https://github.com/openai/whisper) | MIT |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | Apache 2.0 |

## 🙏 Acknowledgments

- **amitpant7** — Fine-tuned Nepali ASR model
- **OpenAI** — Whisper speech recognition
- **Google** — Gemini AI for document generation
- **HuggingFace** — Transformers library and model hosting
- **Tesseract.js** — Client-side OCR engine
- **Nepal Government** — Document format references

---

<div align="center">

**सरकारी-सारथी** — Digital Nepal Initiative 🇳🇵

Made with ❤️ for Nepal

</div>

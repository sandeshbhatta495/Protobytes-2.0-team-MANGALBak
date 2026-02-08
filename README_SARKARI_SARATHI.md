# Sarkari-Sarathi — AI Digital Scribe for Local Government (Nepal)

एक AI-संचालित डिजिटल स्क्राइब जसले नेपाली नागरिकहरूलाई सरकारी कागजातहरू सजिलै उत्पन्न गर्न मद्दत गर्दछ।

## 🎯 Core Features

- **Multi-modal Input**: Voice typing (Fine-tuned Nepali Whisper), free handwriting, and text input
- **AI-Powered Document Generation**: RAG-based template filling with Gemini 1.5 Flash
- **Official Government Templates**: Pre-stored, legally-accepted document formats
- **Print-Ready PDF Output**: A4 format with proper government letterhead
- **Bilingual Support**: Nepali and English with automatic transliteration
- **No Login Required**: Stateless, session-based operation
- **Elder-Friendly UI**: Simple, guided step-by-step interface
- **Enhanced ASR**: Uses fine-tuned Nepali Whisper model with 32% WER accuracy

## 📋 Supported Documents

### Civil Registration
- जन्म दर्ता (Birth Registration)
- मृत्यु दर्ता (Death Registration)
- विवाह दर्ता (Marriage Registration)
- सम्बन्धविच्छेद (Divorce Registration)

### Recommendation Letters
- बसाइसराई प्रमाणपत्र (Migration Certificate)
- बसोबास प्रमाणपत्र (Residence Certificate)

### Infrastructure & Utilities
- विद्युत जडान (Electricity Connection)
- खानेपानी जडान (Water Connection)
- बाटो पहुँच (Road Access)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI Services   │
│   (HTML/JS)     │◄──►│   (FastAPI)     │◄──►│   (Gemini)      │
│                 │    │                 │    │                 │
│ • Voice Input   │    │ • RAG Templates │    │ • Document      │
│ • Text Input    │    │ • PDF Gen       │    │   Generation    │
│ • Free Writing  │    │ • Whisper ASR   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+ (for development tools)
- FFmpeg (for audio processing)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your Gemini API key
   ```

5. **Start the backend server**
   ```bash
   python main.py
   ```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Start a simple HTTP server**
   ```bash
   # Using Python
   python -m http.server 3000
   
   # Or using Node.js
   npx serve . -p 3000
   ```

3. **Open in browser**
   Visit `http://localhost:3000`

## 📁 Project Structure

```
Sarkari-Sarathi/
├── backend/
│   ├── main.py              # FastAPI application with Nepali ASR
│   ├── nepali_asr.py        # Custom Nepali ASR module
│   ├── test_nepali_asr.py  # Test script for ASR integration
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment variables template
│   ├── templates/           # Document templates (JSON)
│   │   ├── birth_registration.json
│   │   ├── migration_certificate.json
│   │   └── electricity_connection.json
│   ├── generated_documents/ # Output PDFs
│   └── static/             # Static files
├── frontend/
│   ├── index.html          # Main application
│   ├── script.js           # Frontend logic
│   └── style.css           # Styling (if needed)
├── Nepali_speech_to_text/  # Fine-tuned Nepali Whisper model
│   └── src/               # ASR source code and utilities
├── Formats Of application/ # Reference documents
└── README_SARKARI_SARATHI.md # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in backend directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
HOST=0.0.0.0
PORT=8000
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads
OUTPUT_DIR=generated_documents
LOG_LEVEL=INFO
```

### Adding New Document Templates

1. Create a new JSON file in `backend/templates/`
2. Follow the template structure:

```json
{
  "name": "Document Name in Nepali",
  "category": "civil_registration|recommendation|infrastructure",
  "required_fields": ["field1", "field2"],
  "content": "Template content with {placeholders}",
  "instructions": ["Step 1", "Step 2"]
}
```

3. Update the frontend form fields in `script.js`

## 🎨 UI/UX Features

- **Step-by-step guided flow**
- **Voice recording with visual feedback**
- **Free handwriting canvas**
- **Real-time transliteration**
- **Document preview before generation**
- **Print-ready PDF output**
- **Service rating and feedback system**

## 🔒 Security & Privacy

- **No permanent data storage**
- **Session-based operation only**
- **Automatic file cleanup**
- **No biometric processing**
- **Secure API endpoints**

## 🌐 API Endpoints

### Document Generation
- `POST /generate-document` - Generate PDF from template
- `GET /document-types` - Get available document types
- `GET /download-document/{filename}` - Download generated PDF

### Audio Processing
- `POST /transcribe-audio` - Transcribe voice to text using Nepali ASR
- `GET /asr-status` - Check status of ASR models

### Text Processing
- `POST /transliterate` - Convert English to Nepali

## 📝 Development Notes

### Voice Input Flow
```
Microphone → Noise Reduction → Nepali ASR (Fine-tuned Whisper) → Nepali Text → Form Fields
```

### Document Generation Flow
```
User Input → Template Matching → RAG Processing → AI Generation → PDF Output
```

### ASR Model Details
- **Primary Model**: `amitpant7/Nepali-Automatic-Speech-Recognition`
- **Fallback Model**: OpenAI Whisper Small
- **Accuracy**: 32% WER on Nepali validation set
- **Features**: Large audio processing, noise handling, chunk-based transcription

### Transliteration
Currently uses basic phonetic mapping. For production, integrate with:
- Google Transliteration API
- Indic NLP Library
- Custom Nepali transliteration models

## 🚀 Deployment

### Docker Deployment (Recommended)

1. **Build Docker image**
   ```bash
   docker build -t sarkari-sarathi .
   ```

2. **Run container**
   ```bash
   docker run -p 8000:8000 -e GEMINI_API_KEY=your_key sarkari-sarathi
   ```

### Production Considerations

- Use HTTPS with SSL certificates
- Implement rate limiting
- Add monitoring and logging
- Set up proper backup for templates
- Use production-grade database for templates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI Whisper for speech recognition
- Google Gemini for AI document generation
- ReportLab for PDF generation
- FastAPI for the backend framework
- The Nepali government for document format references

## 📞 Support

For support and queries:
- Create an issue on GitHub
- Email: support@sarkari-sarathi.gov.np
- Phone: [Government helpline]

---

**सरकारी-सारथी** - Digital Nepal Initiative 🇳🇵

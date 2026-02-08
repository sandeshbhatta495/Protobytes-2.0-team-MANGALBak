from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os
from dotenv import load_dotenv
import json

# Load environment variables from .env file
# Load environment variables from .env.config file (since .env is used as venv dir)
# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(BASE_DIR, ".env.config")
load_dotenv(dotenv_path=config_path)

if not os.getenv("GEMINI_API_KEY"):
    logger.warning("GEMINI_API_KEY not found in .env.config, trying default load_dotenv")
    # Fallback to default check (might load from system env)
    load_dotenv()
import tempfile
from typing import Optional, Dict, Any
import aiofiles
import whisper
import torch
from datetime import datetime
import google.generativeai as genai
from pydantic import BaseModel
import asyncio
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import inch
import textwrap
import logging

# Import our custom Nepali ASR module
from nepali_asr import get_nepali_asr

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Sarkari-Sarathi API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (only if directory exists)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")
else:
    # Create static directory if it doesn't exist
    os.makedirs("static", exist_ok=True)
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Global variables
whisper_model = None
templates = {}
gemini_model = None
nepali_asr = None  # Our custom Nepali ASR instance

class DocumentRequest(BaseModel):
    document_type: str
    user_data: Dict[str, Any]
    language: str = "ne"

class TransliterationRequest(BaseModel):
    text: str
    from_lang: str = "en"
    to_lang: str = "ne"

async def initialize_models():
    global whisper_model, gemini_model, nepali_asr
    
    # Load Whisper model (as fallback)
    try:
        whisper_model = whisper.load_model("small")
        logger.info("Generic Whisper model loaded as fallback")
    except Exception as e:
        logger.warning(f"Failed to load generic Whisper model: {e}")
    
    # Initialize our custom Nepali ASR
    try:
        nepali_asr = get_nepali_asr()
        if nepali_asr.load_model():
            logger.info("Nepali ASR model loaded successfully")
        else:
            logger.warning("Failed to load Nepali ASR model, will use fallback")
    except Exception as e:
        logger.warning(f"Failed to initialize Nepali ASR: {e}")
    
    # Configure Gemini (you'll need to set GEMINI_API_KEY in environment)
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        logger.info("Gemini model configured")
    else:
        logger.warning("GEMINI_API_KEY not found in environment")
    
    # Load templates
    await load_templates()

async def load_templates():
    global templates
    template_dir = "templates"
    if os.path.exists(template_dir):
        for filename in os.listdir(template_dir):
            if filename.endswith('.json'):
                with open(os.path.join(template_dir, filename), 'r', encoding='utf-8') as f:
                    templates[filename[:-5]] = json.load(f)

@app.on_event("startup")
async def startup_event():
    await initialize_models()

@app.get("/")
async def root():
    return {"message": "Sarkari-Sarathi API is running"}

@app.post("/transcribe-audio")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio using Nepali ASR model (with Whisper fallback)
    """
    # Save uploaded audio temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
        content = await audio.read()
        tmp_file.write(content)
        tmp_file_path = tmp_file.name
    
    try:
        transcription = None
        language_detected = "ne"
        
        # Try Nepali ASR first
        if nepali_asr and nepali_asr.pipe is not None:
            try:
                logger.info("Using Nepali ASR model for transcription")
                transcription = nepali_asr.transcribe_audio_file(tmp_file_path)
                logger.info(f"Nepali ASR transcription successful: {transcription[:50]}...")
            except Exception as e:
                logger.warning(f"Nepali ASR failed: {e}")
        
        # Fallback to generic Whisper if Nepali ASR fails
        if not transcription and whisper_model:
            try:
                logger.info("Falling back to generic Whisper model")
                result = whisper_model.transcribe(tmp_file_path)
                transcription = result["text"]
                language_detected = result.get("language", "ne")
                logger.info(f"Whisper transcription successful: {transcription[:50]}...")
            except Exception as e:
                logger.error(f"Whisper fallback also failed: {e}")
        
        if not transcription:
            raise HTTPException(status_code=500, detail="All transcription methods failed")
        
        # Clean up temporary file
        os.unlink(tmp_file_path)
        
        return {
            "transcription": transcription,
            "language": language_detected,
            "model_used": "nepali_asr" if nepali_asr and nepali_asr.pipe is not None else "whisper_fallback"
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Clean up temporary file if it exists
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.get("/asr-status")
async def get_asr_status():
    """Get the status of ASR models"""
    global nepali_asr, whisper_model
    
    status = {
        "nepali_asr": {
            "available": nepali_asr is not None and nepali_asr.pipe is not None,
            "model": nepali_asr.model_name if nepali_asr else None,
            "device": nepali_asr.device if nepali_asr else None
        },
        "whisper_fallback": {
            "available": whisper_model is not None,
            "model": "openai/whisper-small" if whisper_model else None
        }
    }
    
    return status

@app.post("/transliterate")
async def transliterate_text(request: TransliterationRequest):
    # Simple transliteration mapping (in production, use a proper library)
    transliteration_map = {
        'a': 'अ', 'b': 'ब्', 'c': 'क्', 'd': 'द्', 'e': 'ए', 'f': 'फ्', 'g': 'ग्',
        'h': 'ह्', 'i': 'इ', 'j': 'ज्', 'k': 'क्', 'l': 'ल्', 'm': 'म्', 'n': 'न्',
        'o': 'ओ', 'p': 'प्', 'q': 'क्', 'r': 'र्', 's': 'स्', 't': 'त्', 'u': 'उ',
        'v': 'व्', 'w': 'व्', 'x': 'क्स्', 'y': 'य्', 'z': 'ज्'
    }
    
    # This is a very basic transliteration - in production use Indic NLP Library
    nepali_text = request.text
    if request.from_lang == "en":
        # Simple phonetic conversion
        nepali_text = request.text  # Placeholder for proper transliteration
    
    return {"original_text": request.text, "transliterated_text": nepali_text}

@app.post("/generate-document")
async def generate_document(request: DocumentRequest):
    if request.document_type not in templates:
        raise HTTPException(status_code=400, detail="Document template not found")
    
    template = templates[request.document_type]
    
    # Validate required fields
    missing_fields = []
    for field in template.get("required_fields", []):
        if field not in request.user_data or not request.user_data[field]:
            missing_fields.append(field)
    
    if missing_fields:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required fields: {', '.join(missing_fields)}"
        )
    
    try:
        # Generate document content using template
        document_content = fill_template(template, request.user_data)
        
        # Generate PDF
        pdf_path = await generate_pdf(document_content, request.document_type, request.user_data)
        
        return {
            "document_id": f"{request.document_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "pdf_path": pdf_path,
            "content": document_content
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document generation failed: {str(e)}")

def fill_template(template: Dict, user_data: Dict) -> str:
    """Fill template with user data"""
    content = template["content"]
    
    # Replace placeholders with actual data
    for key, value in user_data.items():
        placeholder = f"{{{key}}}"
        content = content.replace(placeholder, str(value))
    
    # Add current date in Bikram Sambat (simplified)
    current_date = datetime.now().strftime("%Y-%m-%d")
    content = content.replace("{date}", current_date)
    content = content.replace("{date_bs}", convert_to_bikram_sambat(current_date))
    
    return content

def convert_to_bikram_sambat(date_gregorian: str) -> str:
    """Convert Gregorian date to Bikram Sambat (simplified)"""
    # This is a placeholder - in production, use proper conversion library
    return date_gregorian  # Simplified for demo

async def generate_pdf(content: str, document_type: str, user_data: Dict) -> str:
    """Generate PDF document"""
    # Create output directory if it doesn't exist
    output_dir = "generated_documents"
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{document_type}_{timestamp}.pdf"
    filepath = os.path.join(output_dir, filename)
    
    # Create PDF
    c = canvas.Canvas(filepath, pagesize=A4)
    width, height = A4
    
    # Try to register a Nepali font (fallback to default if not available)
    try:
        # You would need to add a Nepali font file to your project
        # pdfmetrics.registerFont(TTFont('Nepali', 'fonts/nepali.ttf'))
        # font_name = 'Nepali'
        font_name = 'Helvetica'  # Fallback
    except:
        font_name = 'Helvetica'
    
    # Set font
    c.setFont(font_name, 12)
    
    # Add government header
    c.setFont(font_name, 16, bold=True)
    c.drawString(inch, height - inch, "काठमाडौं महानगरपालिका")
    c.setFont(font_name, 14)
    c.drawString(inch, height - 1.3*inch, "वडा नं. [वडा नं.]")
    
    # Add subject line
    c.setFont(font_name, 12, bold=True)
    subject = f"विषय: {get_document_subject(document_type)}"
    c.drawString(inch, height - 1.8*inch, subject)
    
    # Add content
    c.setFont(font_name, 11)
    y_position = height - 2.2*inch
    
    # Wrap text and add line by line
    lines = content.split('\n')
    for line in lines:
        if line.strip():
            # Handle long lines by wrapping
            wrapped_lines = textwrap.wrap(line, width=80)
            for wrapped_line in wrapped_lines:
                if y_position > 2*inch:  # Leave space for signatures
                    c.drawString(inch, y_position, wrapped_line)
                    y_position -= 0.25*inch
                else:
                    c.showPage()
                    c.setFont(font_name, 11)
                    y_position = height - inch
                    c.drawString(inch, y_position, wrapped_line)
                    y_position -= 0.25*inch
        else:
            y_position -= 0.15*inch
    
    # Add signature spaces
    y_position = 2*inch
    c.setFont(font_name, 10)
    c.drawString(inch, y_position, "आवेदकको हस्ताक्षर:")
    c.drawString(inch + 3*inch, y_position, "नाम:")
    c.drawString(inch + 5*inch, y_position, "प्रमाणीकरण:")
    
    # Add date
    c.drawString(width - 2*inch, y_position, f"मिति: {datetime.now().strftime('%Y-%m-%d')}")
    
    # Save PDF
    c.save()
    
    return filepath

def get_document_subject(document_type: str) -> str:
    """Get Nepali subject line for document type"""
    subjects = {
        "birth_registration": "जन्म दर्ताको निवेदन",
        "death_registration": "मृत्यु दर्ताको निवेदन", 
        "marriage_registration": "विवाह दर्ताको निवेदन",
        "migration_certificate": "बसाइसराई प्रमाणपत्रको निवेदन",
        "residence_certificate": "बसोबास प्रमाणपत्रको निवेदन",
        "electricity_connection": "विद्युत जडानको निवेदन",
        "water_connection": "खानेपानी जडानको निवेदन",
        "road_access": "बाटो पहुँचको निवेदन"
    }
    return subjects.get(document_type, "निवेदन")

@app.get("/download-document/{filename}")
async def download_document(filename: str):
    """Download generated document"""
    file_path = os.path.join("generated_documents", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Document not found")
    
    return FileResponse(file_path, media_type='application/pdf', filename=filename)

@app.get("/document-types")
async def get_document_types():
    """Get available document types"""
    return {
        "document_types": list(templates.keys()),
        "categories": {
            "civil_registration": ["birth_registration", "death_registration", "marriage_registration", "divorce_registration"],
            "recommendation": ["migration_certificate", "residence_certificate"],
            "infrastructure": ["electricity_connection", "water_connection", "road_access"]
        }
    }

if __name__ == "__main__":
    import socket
    import sys
    
    # Find available port starting from 8000
    def find_available_port(start_port=8000):
        for port in range(start_port, start_port + 10):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(('localhost', port))
                    s.close()
                    return port
            except OSError:
                continue
        return None
    
    available_port = find_available_port()
    if available_port:
        print(f"🌐 Starting server on port {available_port}")
        print(f"📄 API docs at: http://localhost:{available_port}/docs")
        uvicorn.run(app, host="0.0.0.0", port=available_port)
    else:
        print("❌ No available ports found in range 8000-8010")
        print("Please close some applications and try again")
        sys.exit(1)

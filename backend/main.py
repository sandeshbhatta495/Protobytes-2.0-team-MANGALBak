from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
import uvicorn
import os
from dotenv import load_dotenv
import json
import subprocess
import shutil
import tempfile
from typing import Optional, Dict, Any, List
import aiofiles
import whisper
import torch
from datetime import datetime
from pydantic import BaseModel
import asyncio
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import inch
import textwrap
import logging
from PIL import Image
import io
import base64

# Configure FFmpeg path - MUST be before any audio library imports
def setup_ffmpeg_path():
    """Setup FFmpeg in PATH for audio processing"""
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = os.path.dirname(ffmpeg_exe)
        ffmpeg_standard = os.path.join(ffmpeg_dir, "ffmpeg.exe")
        
        # Create standard ffmpeg.exe if needed
        if not os.path.exists(ffmpeg_standard):
            shutil.copy2(ffmpeg_exe, ffmpeg_standard)
            print(f"[FFmpeg] Created: {ffmpeg_standard}")
        
        # Prepend to PATH
        current_path = os.environ.get("PATH", "")
        if ffmpeg_dir not in current_path:
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + current_path
        
        os.environ["FFMPEG_BINARY"] = ffmpeg_standard
        return ffmpeg_standard
    except Exception as e:
        print(f"[FFmpeg] Setup failed: {e}")
        return None

FFMPEG_PATH = setup_ffmpeg_path()

# Load env variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
load_dotenv(os.path.join(BASE_DIR, ".env.config"))
load_dotenv()

# Import custom modules
from nepali_asr import get_nepali_asr
from grammar import correct_nepali_text

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Sarkari-Sarathi API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
static_dir = os.path.join(BASE_DIR, "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

if os.path.exists(FRONTEND_DIR):
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

# Global state
whisper_model = None
templates = {}
nepali_asr = None

# Pydantic Models
class DocumentRequest(BaseModel):
    document_type: str
    user_data: Dict[str, Any]
    language: str = "ne"

class TransliterationRequest(BaseModel):
    text: str
    from_lang: str = "en"
    to_lang: str = "ne"

class HandwritingRequest(BaseModel):
    image: str

class GrammarCorrectionRequest(BaseModel):
    text: str
    context: str = ""

# Initialization
async def initialize_models():
    global whisper_model, nepali_asr
    await load_templates()
    
    # Load Whisper
    try:
        whisper_model = whisper.load_model("base")
        logger.info("Generic Whisper (base) loaded")
    except Exception as e:
        logger.warning(f"Whisper load failed: {e}")
    
    # Load Nepali ASR
    try:
        nepali_asr = get_nepali_asr()
        if nepali_asr.load_model():
            logger.info("Nepali ASR loaded")
        else:
            logger.warning("Nepali ASR failed to load")
    except Exception as e:
        logger.warning(f"Nepali ASR init failed: {e}")

async def load_templates():
    global templates
    template_dir = os.path.join(BASE_DIR, "templates")
    if not os.path.exists(template_dir): return
    for f in os.listdir(template_dir):
        if f.endswith('.json'):
            try:
                with open(os.path.join(template_dir, f), 'r', encoding='utf-8') as file:
                    templates[f[:-5]] = json.load(file)
            except Exception as e:
                logger.error(f"Template load error {f}: {e}")

@app.on_event("startup")
async def startup_event():
    await initialize_models()

# Endpoints
@app.get("/")
def root(): return {"message": "Sarkari-Sarathi API (Offline Mode)"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "nepali_asr": nepali_asr is not None and nepali_asr.pipe is not None,
        "whisper": whisper_model is not None,
        "tesseract": shutil.which("tesseract") is not None
    }

@app.post("/transcribe-audio")
async def transcribe_audio(audio: UploadFile = File(...)):
    suffix = os.path.splitext(audio.filename)[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name
    
    wav_path = tmp_path + ".wav"
    conversion_success = False
    
    # Try to convert audio to WAV format (16kHz mono)
    # Method 1: Use FFmpeg directly with full path
    if FFMPEG_PATH and os.path.exists(FFMPEG_PATH):
        try:
            result = subprocess.run(
                [FFMPEG_PATH, '-y', '-i', tmp_path, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav_path],
                capture_output=True, check=True, timeout=30
            )
            conversion_success = os.path.exists(wav_path) and os.path.getsize(wav_path) > 100
            logger.info(f"FFmpeg conversion {'succeeded' if conversion_success else 'failed'}")
        except Exception as e:
            logger.warning(f"FFmpeg conversion failed: {e}")
    
    # Method 2: Fallback to pydub
    if not conversion_success:
        try:
            from pydub import AudioSegment
            audio_seg = AudioSegment.from_file(tmp_path)
            audio_seg = audio_seg.set_frame_rate(16000).set_channels(1)
            audio_seg.export(wav_path, format="wav")
            conversion_success = os.path.exists(wav_path) and os.path.getsize(wav_path) > 100
            logger.info(f"Pydub conversion {'succeeded' if conversion_success else 'failed'}")
        except Exception as e:
            logger.warning(f"Pydub conversion failed: {e}")
    
    # Use original file if conversion failed
    if not conversion_success:
        wav_path = tmp_path
        logger.warning("Audio conversion failed, using original file")

    text = ""
    model_used = ""
    try:
        if nepali_asr and nepali_asr.pipe:
            text = nepali_asr.transcribe_audio_file(wav_path)
            model_used = "nepali_asr"
        
        if not text and whisper_model:
            text = whisper_model.transcribe(wav_path, language='ne').get("text", "")
            model_used = "whisper"
            
        if not text: raise HTTPException(500, "Transcription failed")
        
        return {
            "transcription": correct_nepali_text(text),
            "raw_transcription": text,
            "model_used": model_used
        }
    finally:
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        if os.path.exists(wav_path) and wav_path != tmp_path: os.unlink(wav_path)

@app.post("/transliterate")
async def transliterate_endpoint(req: TransliterationRequest):
    result = offline_transliterate(req.text)
    # Apply Unicode normalization
    import unicodedata
    result = unicodedata.normalize('NFC', result)
    return {"original_text": req.text, "transliterated_text": result, "method": "offline"}

def offline_transliterate(text: str) -> str:
    """
    Enhanced Roman-to-Nepali transliteration with improved pattern matching.
    """
    if not text:
        return ""
    
    import unicodedata
    
    # Multi-character mappings (longest patterns first for priority)
    multi_map = {
        # Conjuncts and special combinations
        'shri': 'श्री', 'shree': 'श्री',
        'kshya': 'क्ष्य', 'ksha': 'क्षा', 'ksh': 'क्ष',
        'gya': 'ज्ञ', 'dnya': 'ज्ञ', 'gnya': 'ज्ञ',
        'tra': 'त्र', 'tri': 'त्रि', 'tru': 'त्रु',
        'dra': 'द्र', 'dri': 'द्रि',
        'pra': 'प्र', 'pri': 'प्रि',
        'bra': 'ब्र', 'bri': 'ब्रि',
        'shr': 'श्र', 'shra': 'श्रा',
        'ntr': 'न्त्र', 'ndr': 'न्द्र',
        'str': 'स्त्र', 'sta': 'स्ता',
        'sth': 'स्थ', 'stha': 'स्था',
        'sna': 'स्ना', 'swa': 'स्वा', 'sw': 'स्व',
        'tth': 'त्थ', 'ddh': 'द्ध',
        'nch': 'न्च', 'nj': 'न्ज', 'nd': 'न्द', 'nt': 'न्त',
        'mp': 'म्प', 'mb': 'म्ब',
        'ng': 'ङ', 'nk': 'ङ्क', 
        'rya': 'र्य', 'ryu': 'र्यु',
        # Aspirated consonants with vowels
        'chha': 'छा', 'chhi': 'छि', 'chhu': 'छु', 'chhe': 'छे', 'chho': 'छो',
        'chh': 'छ',
        'kha': 'खा', 'khi': 'खि', 'khu': 'खु', 'khe': 'खे', 'kho': 'खो',
        'kh': 'ख',
        'gha': 'घा', 'ghi': 'घि', 'ghu': 'घु', 'ghe': 'घे', 'gho': 'घो',
        'gh': 'घ',
        'cha': 'चा', 'chi': 'चि', 'chu': 'चु', 'che': 'चे', 'cho': 'चो',
        'ch': 'च',
        'jha': 'झा', 'jhi': 'झि', 'jhu': 'झु', 'jhe': 'झे', 'jho': 'झो',
        'jh': 'झ',
        'tha': 'था', 'thi': 'थि', 'thu': 'थु', 'the': 'थे', 'tho': 'थो',
        'th': 'थ',
        'dha': 'धा', 'dhi': 'धि', 'dhu': 'धु', 'dhe': 'धे', 'dho': 'धो',
        'dh': 'ध',
        'pha': 'फा', 'phi': 'फि', 'phu': 'फु', 'phe': 'फे', 'pho': 'फो',
        'ph': 'फ',
        'bha': 'भा', 'bhi': 'भि', 'bhu': 'भु', 'bhe': 'भे', 'bho': 'भो',
        'bh': 'भ',
        'sha': 'शा', 'shi': 'शि', 'shu': 'शु', 'she': 'शे', 'sho': 'शो',
        'sh': 'श',
        'ny': 'ञ',
        # Vowel combinations
        'aa': 'ा', 'ee': 'ी', 'ii': 'ी', 'oo': 'ू', 'uu': 'ू',
        'ai': 'ै', 'au': 'ौ', 'ou': 'ौ', 'ei': 'ै',
        'ri': 'ृ', 'ru': 'ू',
        # Retroflex consonants
        'tt': 'ट', 'tth': 'ठ', 'dd': 'ड', 'ddh': 'ढ', 'nn': 'ण',
    }
    
    # Standalone vowels (at word beginning or after another vowel)
    vowel_standalone = {
        'a': 'अ', 'i': 'इ', 'u': 'उ', 'e': 'ए', 'o': 'ओ'
    }
    
    # Vowel matras (after consonant)
    vowel_matra = {
        'a': '', 'i': 'ि', 'u': 'ु', 'e': 'े', 'o': 'ो'
    }
    
    # Basic consonants
    consonant_map = {
        'k': 'क', 'g': 'ग', 'c': 'च', 'j': 'ज', 't': 'त',
        'd': 'द', 'n': 'न', 'p': 'प', 'b': 'ब', 'm': 'म',
        'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व', 'w': 'व',
        's': 'स', 'h': 'ह', 'f': 'फ', 'z': 'ज़', 'x': 'क्स', 'q': 'क'
    }
    
    # Common full word mappings
    word_map = {
        'nepal': 'नेपाल', 'kathmandu': 'काठमाडौं', 'pokhara': 'पोखरा',
        'address': 'ठेगाना', 'date': 'मिति', 'name': 'नाम',
        'province': 'प्रदेश', 'district': 'जिल्ला', 'ward': 'वडा',
        'municipality': 'नगरपालिका', 'village': 'गाउँ',
        'father': 'बुबा', 'mother': 'आमा', 'son': 'छोरा', 'daughter': 'छोरी',
        'husband': 'पति', 'wife': 'पत्नी', 'male': 'पुरुष', 'female': 'महिला',
        'birth': 'जन्म', 'death': 'मृत्यु', 'marriage': 'विवाह',
        'application': 'निवेदन', 'certificate': 'प्रमाणपत्र',
        'year': 'वर्ष', 'month': 'महिना', 'day': 'दिन',
        'sharma': 'शर्मा', 'thapa': 'थापा', 'gurung': 'गुरुङ',
        'tamang': 'तामाङ', 'rai': 'राई', 'limbu': 'लिम्बु',
        'shrestha': 'श्रेष्ठ', 'magar': 'मगर', 'newar': 'नेवार',
        'bahadur': 'बहादुर', 'kumar': 'कुमार', 'devi': 'देवी',
        'maya': 'माया', 'laxmi': 'लक्ष्मी', 'krishna': 'कृष्ण',
        'ram': 'राम', 'sita': 'सीता', 'hari': 'हरि', 'shiva': 'शिव',
    }
    
    # Check for full word match first
    text_lower = text.lower().strip()
    if text_lower in word_map:
        return word_map[text_lower]

    result = []
    i = 0
    after_consonant = False
    
    while i < len(text):
        char = text[i].lower()
        matched = False
        
        # Handle spaces
        if char == ' ':
            result.append(' ')
            after_consonant = False
            i += 1
            continue
        
        # Handle digits - convert to Devanagari
        if char in '0123456789':
            result.append('०१२३४५६७८९'[int(char)])
            after_consonant = False
            i += 1
            continue
        
        # Handle punctuation
        if not char.isalpha():
            result.append(char)
            after_consonant = False
            i += 1
            continue
        
        # Multi-character matches (try longest first)
        for length in range(5, 1, -1):
            if i + length > len(text):
                continue
            substr = text[i:i+length].lower()
            if substr in multi_map:
                # Check if this is a vowel matra or consonant
                mapped = multi_map[substr]
                if mapped in ['ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ृ']:
                    # It's a vowel matra
                    if after_consonant:
                        result.append(mapped)
                    else:
                        # Convert matra to standalone vowel
                        matra_to_vowel = {
                            'ा': 'आ', 'ि': 'इ', 'ी': 'ई', 'ु': 'उ', 'ू': 'ऊ',
                            'े': 'ए', 'ै': 'ऐ', 'ो': 'ओ', 'ौ': 'औ', 'ृ': 'ऋ'
                        }
                        result.append(matra_to_vowel.get(mapped, mapped))
                    after_consonant = False
                else:
                    result.append(mapped)
                    # Check if ends with vowel
                    after_consonant = not any(substr.endswith(v) for v in 'aeiou')
                i += length
                matched = True
                break
        
        if matched:
            continue
        
        # Single consonant
        if char in consonant_map:
            if after_consonant:
                result.append('्')  # Halant to join consonants
            result.append(consonant_map[char])
            after_consonant = True
            i += 1
        # Single vowel
        elif char in vowel_standalone:
            if after_consonant:
                result.append(vowel_matra[char])
            else:
                result.append(vowel_standalone[char])
            after_consonant = False
            i += 1
        else:
            # Unknown character - pass through
            result.append(text[i])
            after_consonant = False
            i += 1
    
    output = ''.join(result)
    # Apply Unicode NFC normalization
    return unicodedata.normalize('NFC', output)

@app.post("/correct-grammar")
async def correct_grammar_endpoint(req: GrammarCorrectionRequest):
    return {"original": req.text, "corrected": correct_nepali_text(req.text)}

@app.post("/recognize-handwriting")
async def recognize_handwriting(req: HandwritingRequest):
    if not shutil.which("tesseract"): raise HTTPException(503, "Tesseract not found")
    try:
        img_bytes = base64.b64decode(req.image.split(',')[1] if ',' in req.image else req.image)
        img = Image.open(io.BytesIO(img_bytes))
        
        # Enhanced preprocessing for better OCR
        # 1. Convert to grayscale
        img = img.convert('L')
        
        # 2. Resize for better recognition (Tesseract prefers larger images)
        scale_factor = 2
        new_size = (img.width * scale_factor, img.height * scale_factor)
        img = img.resize(new_size, Image.LANCZOS)
        
        # 3. Add padding (white border)
        padding = 40
        padded = Image.new('L', (img.width + padding*2, img.height + padding*2), 255)
        padded.paste(img, (padding, padding))
        img = padded
        
        # 4. Binarization with adaptive threshold
        import numpy as np
        img_array = np.array(img)
        
        # Simple adaptive threshold: compare each pixel to local mean
        # Use lower threshold to keep more stroke details
        threshold = 200
        binary = np.where(img_array < threshold, 0, 255).astype(np.uint8)
        
        # 5. Dilation to thicken strokes (morphological operation)
        # Simple dilation: if any neighbor is black, make this black
        dilated = binary.copy()
        for i in range(2):  # Two passes of dilation
            temp = dilated.copy()
            for y in range(1, dilated.shape[0] - 1):
                for x in range(1, dilated.shape[1] - 1):
                    if temp[y-1:y+2, x-1:x+2].min() == 0:
                        dilated[y, x] = 0
        
        # Convert back to PIL Image
        img = Image.fromarray(dilated)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            img.save(tmp, format="PNG")
            tmp_path = tmp.name
        
        try:
            # PSM 7 = single line, PSM 6 = single block
            # Try PSM 6 first for multi-line support
            res = subprocess.run([
                'tesseract', tmp_path, 'stdout', 
                '-l', 'nep+eng', 
                '--psm', '6',
                '--oem', '1'  # LSTM engine only
            ], capture_output=True, text=True, check=True)
            text = res.stdout.strip()
            
            # If no result, try single line mode
            if not text:
                res = subprocess.run([
                    'tesseract', tmp_path, 'stdout', 
                    '-l', 'nep+eng', 
                    '--psm', '7'
                ], capture_output=True, text=True, check=True)
                text = res.stdout.strip()
            
            return {"text": correct_nepali_text(text), "success": True}
        finally:
            if os.path.exists(tmp_path): os.unlink(tmp_path)
    except Exception as e:
        logger.error(f"Handwriting error: {e}")
        raise HTTPException(500, str(e))

@app.post("/generate-document")
async def generate_document(req: DocumentRequest):
    if req.document_type not in templates: raise HTTPException(400, "Template not found")
    try:
        content = fill_template(templates[req.document_type], req.user_data)
        path = await generate_pdf(content, req.document_type, req.user_data)
        return {"document_id": f"{req.document_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}", "pdf_path": path, "content": content}
    except Exception as e:
        logger.error(f"Doc gen error: {e}")
        raise HTTPException(500, str(e))

def fill_template(template, data):
    content = template.get("content", "")
    for k, v in data.items(): content = content.replace(f"{{{k}}}", str(v) if v else "")
    date = datetime.now().strftime("%Y-%m-%d")
    content = content.replace("{date}", date).replace("{date_bs}", convert_to_bikram_sambat(date))
    import re
    return re.sub(r'\{[a-zA-Z_]+\}', '..........', content)

def convert_to_bikram_sambat(date_str):
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        y, m, d = dt.year+56, dt.month+8, dt.day+16
        if d>30: d-=30; m+=1
        if m>12: m-=12; y+=1
        return f"{y}-{m:02d}-{d:02d}"
    except: return date_str

_font_reg = False
_font_name = 'Helvetica'
def _ensure_font():
    global _font_reg, _font_name
    if _font_reg: return _font_name
    try:
        path = os.path.join(BASE_DIR, 'static', 'fonts', 'NotoSansDevanagari-Regular.ttf')
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont('NotoSansDevanagari', path))
            _font_name = 'NotoSansDevanagari'
        else:
             # Win fallback
            import platform
            if platform.system() == 'Windows':
                sys_font = r'C:\Windows\Fonts\Nirmala.ttf'
                if not os.path.exists(sys_font): sys_font = r'C:\Windows\Fonts\mangal.ttf'
                if os.path.exists(sys_font):
                    pdfmetrics.registerFont(TTFont('SystemNepali', sys_font))
                    _font_name = 'SystemNepali'
    except: pass
    _font_reg = True
    return _font_name

def _wrap_nepali_text(text, max_chars=45):
    """
    Wrap Nepali text accounting for Devanagari character widths.
    Devanagari characters are approximately 1.5-2x width of ASCII.
    Using conservative estimate of 45 chars per line for 11pt font on A4.
    """
    if not text:
        return []
    
    lines = []
    for paragraph in text.split('\n'):
        if not paragraph.strip():
            lines.append('')
            continue
            
        words = paragraph.split()
        current_line = ''
        
        for word in words:
            test_line = current_line + (' ' if current_line else '') + word
            # Count Devanagari chars as 1.5 width
            effective_len = 0
            for ch in test_line:
                if '\u0900' <= ch <= '\u097F':  # Devanagari range
                    effective_len += 1.5
                else:
                    effective_len += 1
            
            if effective_len <= max_chars:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        
        if current_line:
            lines.append(current_line)
    
    return lines

async def generate_pdf(content, dtype, data):
    out = os.path.join(BASE_DIR, "generated_documents")
    os.makedirs(out, exist_ok=True)
    fpath = os.path.join(out, f"{dtype}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
    
    c = canvas.Canvas(fpath, pagesize=A4)
    w, h = A4
    font = _ensure_font()
    
    # A4: 595.27 x 841.89 points (72 points/inch)
    # Standard margins: 1 inch = 72 points
    margin_left = 72
    margin_right = 72
    margin_top = 72
    margin_bottom = 72
    usable_width = w - margin_left - margin_right
    line_height = 16  # Line height for 11pt font
    
    # Header Section
    y = h - margin_top
    
    c.setFont(font, 14)
    c.drawCentredString(w/2, y, "नेपाल सरकार")
    y -= 22
    
    c.setFont(font, 16)
    municipality = str(data.get('municipality', 'स्थानीय तह'))
    c.drawCentredString(w/2, y, municipality)
    y -= 18
    
    c.setFont(font, 11)
    if data.get('district') and data.get('province'): 
        c.drawCentredString(w/2, y, f"{data['district']}, {data['province']}")
        y -= 15
    if data.get('ward'): 
        c.drawCentredString(w/2, y, f"वडा नं. {data['ward']} को कार्यालय")
        y -= 15
    
    # Horizontal line
    y -= 5
    c.line(margin_left, y, w - margin_right, y)
    y -= 20
    
    # Date (right aligned)
    c.setFont(font, 10)
    date_text = f"मिति: {convert_to_bikram_sambat(datetime.now().strftime('%Y-%m-%d'))}"
    c.drawRightString(w - margin_right, y, date_text)
    y -= 20
    
    # Subject
    c.setFont(font, 12)
    subject_map = {
        'birth_registration': 'जन्म दर्ता निवेदन',
        'death_registration': 'मृत्यु दर्ता निवेदन',
        'marriage_registration': 'विवाह दर्ता निवेदन',
        'divorce_registration': 'सम्बन्ध विच्छेद निवेदन',
        'electricity_connection': 'विद्युत जडान निवेदन',
        'water_connection': 'खानेपानी जडान निवेदन',
        'migration_certificate': 'बसाइसराई प्रमाणपत्र निवेदन',
        'residence_certificate': 'बसोबास प्रमाणपत्र निवेदन',
        'road_access': 'बाटो निकासा निवेदन'
    }
    subject = subject_map.get(dtype, dtype.replace('_', ' ').title())
    c.drawString(margin_left, y, f"विषय: {subject}")
    y -= 25
    
    # Body content
    c.setFont(font, 11)
    wrapped_lines = _wrap_nepali_text(content, max_chars=50)
    
    for line in wrapped_lines:
        # Check if we need a new page
        if y < margin_bottom + 100:  # Leave room for footer
            c.showPage()
            c.setFont(font, 11)
            y = h - margin_top
        
        c.drawString(margin_left, y, line)
        y -= line_height
        
        # Extra space after empty lines (paragraph breaks)
        if not line.strip():
            y -= 8
    
    # Footer section - ensure enough space
    footer_space_needed = 80
    if y < margin_bottom + footer_space_needed:
        c.showPage()
        c.setFont(font, 11)
        y = h - margin_top - 50
    
    y = max(y - 30, margin_bottom + 60)
    
    # Signature lines
    c.drawString(margin_left, y, "..................")
    c.drawString(margin_left, y - 15, "निवेदक")
    
    c.drawRightString(w - margin_right, y, "..................")
    c.drawRightString(w - margin_right, y - 15, "अधिकृत")
    
    c.save()
    return fpath

@app.get("/locations")
def locations():
    f = os.path.join(BASE_DIR, "locations.json")
    if os.path.exists(f): 
        with open(f, 'r', encoding='utf-8') as data: return json.load(data)
    return {}

@app.get("/document-types")
def dtypes(): return {"document_types": list(templates.keys())}

@app.get("/template/{dtype}")
def get_templ(dtype: str): return templates.get(dtype, {})

@app.get("/download-document/{fname}")
def dl_doc(fname: str):
    p = os.path.join(BASE_DIR, "generated_documents", fname)
    if os.path.exists(p): return FileResponse(p, filename=fname)
    raise HTTPException(404)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

"""
Nepali ASR Module - Integrating the fine-tuned Nepali Whisper model
"""
import sys
import os
import textwrap
import librosa
import numpy as np
from transformers import pipeline
import torch
import logging

# Add the Nepali speech-to-text source to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'Nepali_speech_to_text', 'src'))

try:
    from utils import transcribe_large_audio, mp3_to_wav
except ImportError:
    # Fallback if utils module not available
    def transcribe_large_audio(file_path, chunk_duration_sec=20, overlap_duration_sec=0.5):
        """Fallback transcription function"""
        return None
    
    def mp3_to_wav(input_file, output_file):
        """Fallback conversion function"""
        return None

class NepaliASR:
    """Nepali Automatic Speech Recognition using fine-tuned Whisper model"""
    
    def __init__(self, model_name='amitpant7/Nepali-Automatic-Speech-Recognition'):
        """
        Initialize the Nepali ASR model
        
        Args:
            model_name: HuggingFace model identifier for Nepali ASR
        """
        self.model_name = model_name
        self.pipe = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.logger = logging.getLogger(__name__)
        
    def load_model(self):
        """Load the Nepali ASR model"""
        try:
            self.logger.info(f"Loading Nepali ASR model: {self.model_name}")
            self.pipe = pipeline(
                "automatic-speech-recognition", 
                model=self.model_name,
                device=0 if self.device == "cuda" else -1
            )
            self.logger.info("Nepali ASR model loaded successfully")
            return True
        except Exception as e:
            self.logger.error(f"Failed to load Nepali ASR model: {str(e)}")
            return False
    
    def transcribe_audio_file(self, audio_path):
        """
        Transcribe audio file using the Nepali model
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Transcribed text in Nepali
        """
        if not self.pipe:
            if not self.load_model():
                raise Exception("Failed to load ASR model")
        
        try:
            # Convert to WAV if necessary
            if audio_path.lower().endswith('.mp3'):
                temp_wav = audio_path.replace('.mp3', '_temp.wav')
                try:
                    mp3_to_wav(audio_path, temp_wav)
                    audio_path = temp_wav
                except Exception as e:
                    self.logger.warning(f"MP3 to WAV conversion failed: {e}")
            
            # Try using the specialized large audio transcription first
            try:
                transcription = transcribe_large_audio(audio_path)
                if transcription:
                    return transcription.strip()
            except Exception as e:
                self.logger.warning(f"Large audio transcription failed, falling back to pipeline: {e}")
            
            # Fallback to basic pipeline transcription
            result = self.pipe(audio_path)
            transcription = result['text']
            
            # Clean up temporary file if created
            if audio_path.endswith('_temp.wav') and os.path.exists(audio_path):
                os.remove(audio_path)
            
            return transcription.strip()
            
        except Exception as e:
            self.logger.error(f"Transcription failed: {str(e)}")
            raise Exception(f"Audio transcription failed: {str(e)}")
    
    def transcribe_audio_data(self, audio_data, sample_rate=16000):
        """
        Transcribe audio data from memory
        
        Args:
            audio_data: Audio data as numpy array
            sample_rate: Sample rate of audio data
            
        Returns:
            Transcribed text in Nepali
        """
        if not self.pipe:
            if not self.load_model():
                raise Exception("Failed to load ASR model")
        
        try:
            # Create a temporary file for the audio data
            import tempfile
            import soundfile as sf
            
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                sf.write(tmp_file.name, audio_data, sample_rate)
                temp_path = tmp_file.name
            
            # Transcribe the temporary file
            transcription = self.transcribe_audio_file(temp_path)
            
            # Clean up temporary file
            os.unlink(temp_path)
            
            return transcription
            
        except Exception as e:
            self.logger.error(f"Audio data transcription failed: {str(e)}")
            raise Exception(f"Audio data transcription failed: {str(e)}")
    
    def get_model_info(self):
        """Get information about the loaded model"""
        return {
            "model_name": self.model_name,
            "device": self.device,
            "loaded": self.pipe is not None,
            "language": "Nepali",
            "description": "Fine-tuned Whisper model for Nepali speech recognition"
        }

# Global instance for reuse
nepali_asr_instance = None

def get_nepali_asr():
    """Get or create the global Nepali ASR instance"""
    global nepali_asr_instance
    if nepali_asr_instance is None:
        nepali_asr_instance = NepaliASR()
    return nepali_asr_instance

# CLI usage for testing
if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('Usage: python nepali_asr.py audio_file.mp3')
        sys.exit(0)
    
    audio_path = sys.argv[1]
    
    if not os.path.exists(audio_path):
        print(f"Audio file not found: {audio_path}")
        sys.exit(1)
    
    asr = NepaliASR()
    try:
        transcription = asr.transcribe_audio_file(audio_path)
        formatted_text = textwrap.fill(transcription, width=50)
        print("Transcription:")
        print(formatted_text)
    except Exception as e:
        print(f"Transcription failed: {e}")
        sys.exit(1)

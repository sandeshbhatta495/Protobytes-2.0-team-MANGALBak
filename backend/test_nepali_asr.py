"""
Test script for Nepali ASR integration
"""
import os
import sys
import requests
import json

# Add the backend directory to path to import our modules
sys.path.append(os.path.dirname(__file__))

from nepali_asr import NepaliASR

def test_nepali_asr_direct():
    """Test the Nepali ASR module directly"""
    print("=== Testing Nepali ASR Directly ===")
    
    try:
        # Initialize ASR
        asr = NepaliASR()
        
        # Load model
        print("Loading Nepali ASR model...")
        if asr.load_model():
            print("✅ Nepali ASR model loaded successfully")
        else:
            print("❌ Failed to load Nepali ASR model")
            return False
        
        # Get model info
        info = asr.get_model_info()
        print(f"Model info: {json.dumps(info, indent=2)}")
        
        # Test with a sample audio file if available
        sample_audio = "../Nepali_speech_to_text/src/test.mp3"
        if os.path.exists(sample_audio):
            print(f"\nTesting with sample audio: {sample_audio}")
            try:
                transcription = asr.transcribe_audio_file(sample_audio)
                print(f"✅ Transcription successful: {transcription}")
            except Exception as e:
                print(f"❌ Transcription failed: {e}")
        else:
            print(f"⚠️  Sample audio not found at {sample_audio}")
        
        return True
        
    except Exception as e:
        print(f"❌ Direct test failed: {e}")
        return False

def test_api_endpoints():
    """Test the API endpoints"""
    print("\n=== Testing API Endpoints ===")
    
    base_url = "http://localhost:8000"
    
    # Test ASR status
    try:
        response = requests.get(f"{base_url}/asr-status")
        if response.status_code == 200:
            status = response.json()
            print("✅ ASR Status endpoint working:")
            print(json.dumps(status, indent=2))
        else:
            print(f"❌ ASR Status endpoint failed: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("⚠️  API server not running. Start with: python main.py")
        return False
    except Exception as e:
        print(f"❌ ASR Status test failed: {e}")
        return False
    
    return True

def main():
    """Main test function"""
    print("🎤 Testing Nepali ASR Integration for Sarkari-Sarathi")
    print("=" * 50)
    
    # Test direct module
    direct_success = test_nepali_asr_direct()
    
    # Test API endpoints
    api_success = test_api_endpoints()
    
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print(f"Direct ASR Test: {'✅ PASSED' if direct_success else '❌ FAILED'}")
    print(f"API Test: {'✅ PASSED' if api_success else '❌ FAILED'}")
    
    if direct_success and api_success:
        print("\n🎉 All tests passed! Nepali ASR is ready for use.")
    else:
        print("\n⚠️  Some tests failed. Check the logs above.")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Test script to verify favicon endpoint is working
"""
import requests
import os

def test_favicon():
    """Test favicon endpoint"""
    try:
        # Test if favicon is accessible
        response = requests.get("http://localhost:8000/favicon.ico", timeout=5)
        
        if response.status_code == 200:
            print("✅ Favicon endpoint is working!")
            print(f"   Content-Type: {response.headers.get('content-type', 'Not specified')}")
            print(f"   Content-Length: {response.headers.get('content-length', 'Not specified')} bytes")
            print(f"   Status Code: {response.status_code}")
            return True
        else:
            print(f"❌ Favicon endpoint returned status code: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure the server is running on port 8000")
        return False
    except Exception as e:
        print(f"❌ Error testing favicon: {e}")
        return False

def test_favicon_file():
    """Test if favicon file exists"""
    favicon_path = r"C:\Users\DELL\OneDrive\Desktop\Nepali STT\backend\static\fonts\fav-icon.png"
    
    if os.path.exists(favicon_path):
        file_size = os.path.getsize(favicon_path)
        print(f"✅ Favicon file exists: {favicon_path}")
        print(f"   File size: {file_size:,} bytes ({file_size/1024:.1f} KB)")
        return True
    else:
        print(f"❌ Favicon file not found: {favicon_path}")
        return False

if __name__ == "__main__":
    print("🔍 Testing Sarkari-Sarathi Favicon Setup")
    print("=" * 50)
    
    # Test file exists
    file_ok = test_favicon_file()
    
    # Test endpoint
    if file_ok:
        print("\n🌐 Testing favicon endpoint...")
        endpoint_ok = test_favicon()
        
        if endpoint_ok:
            print("\n🎉 Favicon setup is complete!")
            print("   Your favicon will appear in browser tabs when accessing the server")
        else:
            print("\n⚠️  Start the server to test the favicon endpoint")
    else:
        print("\n❌ Please check the favicon file path")
    
    print("\n💡 To see the favicon:")
    print("   1. Start the server: python main.py")
    print("   2. Open browser: http://localhost:8000")
    print("   3. Check browser tab - favicon should appear")

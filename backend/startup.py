"""
Startup script for Sarkari-Sarathi backend
Handles dependencies and provides better error messages
"""
import os
import sys
import subprocess
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_ffmpeg():
    """Check if FFmpeg is available"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                          capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            logger.info("FFmpeg is available")
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    
    logger.warning("FFmpeg not found. Audio processing may be limited.")
    logger.info("Install FFmpeg:")
    logger.info("  Windows: choco install ffmpeg")
    logger.info("  Or download from: https://ffmpeg.org/download.html")
    return False

def check_directories():
    """Ensure required directories exist"""
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    directories = ["static", "templates", "generated_documents"]
    
    for dir_name in directories:
        dir_path = os.path.join(script_dir, dir_name)
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            logger.info(f"Created directory: {dir_name}")
        else:
            logger.info(f"Directory exists: {dir_name}")

def check_python_version():
    """Check Python version compatibility"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        logger.error(f"Python {version.major}.{version.minor} detected. Python 3.8+ required.")
        return False
    
    logger.info(f"Python {version.major}.{version.minor}.{version.micro} - OK")
    return True

def install_dependencies():
    """Install required dependencies"""
    logger.info("Installing dependencies...")
    
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    requirements_path = os.path.join(script_dir, "requirements.txt")
    
    if not os.path.exists(requirements_path):
        logger.error(f"Requirements file not found at: {requirements_path}")
        return False
    
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", requirements_path], 
                     check=True)
        logger.info("Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to install dependencies: {e}")
        return False

def main():
    """Main startup function"""
    logger.info("Starting Sarkari-Sarathi Backend Setup")
    logger.info("=" * 50)
    
    # Check system requirements
    if not check_python_version():
        sys.exit(1)
    
    # Check directories
    check_directories()
    
    # Check FFmpeg
    ffmpeg_available = check_ffmpeg()
    
    # Install dependencies
    if not install_dependencies():
        logger.error("Setup failed. Please check the error messages above.")
        sys.exit(1)
    
    logger.info("=" * 50)
    logger.info("Setup complete! Starting the server...")
    logger.info("Server will be available at: http://localhost:8000")
    logger.info("API docs at: http://localhost:8000/docs")
    
    if not ffmpeg_available:
        logger.warning("Note: FFmpeg not available - some audio features may be limited")
    
    # Start the main application
    try:
        import main
        if __name__ == "__main__":
            import uvicorn
            import socket
            
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
                logger.info(f"Starting server on port {available_port}")
                logger.info(f"API docs at: http://localhost:{available_port}/docs")
                uvicorn.run(main.app, host="0.0.0.0", port=available_port)
            else:
                logger.error("No available ports found in range 8000-8010")
                logger.error("Please close some applications and try again")
                sys.exit(1)
                
    except ImportError as e:
        logger.error(f"Failed to import main module: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

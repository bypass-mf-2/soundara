import os
import re
import soundfile as sf

ALLOWED_EXTENSIONS = [".wav", ".mp3", ".flac", ".ogg"]
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

def sanitize_filename(filename: str) -> str:
    # Replace unsafe characters
    return re.sub(r"[^\w\-\.]", "_", filename)

def validate_file_extension(filename: str) -> bool:
    return any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)

def validate_file_size(filepath: str) -> bool:
    return os.path.getsize(filepath) <= MAX_FILE_SIZE

def validate_audio(filepath: str) -> bool:
    try:
        sf.read(filepath)  # just try to read it
        return True
    except RuntimeError:
        return False
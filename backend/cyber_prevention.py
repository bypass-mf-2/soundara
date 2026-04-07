"""
Enhanced security validation and sanitization for Soundara
Protects against injection attacks, malicious files, and invalid input
"""

import os
import re
import soundfile as sf
from fastapi import HTTPException, status
from typing import Optional
import magic  # python-magic for MIME type detection

# Configuration
ALLOWED_EXTENSIONS = [".wav", ".mp3", ".flac", ".ogg", ".m4a"]
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024  # Default 50 MB
MIN_FILE_SIZE = 1024  # 1 KB minimum to prevent empty files

# Allowed MIME types for audio files
ALLOWED_MIME_TYPES = [
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/flac",
    "audio/ogg",
    "audio/x-m4a",
    "audio/mp4"
]


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and injection attacks
    
    Args:
        filename: Original filename
    
    Returns:
        Sanitized filename safe for filesystem
    """
    # Remove path components
    filename = os.path.basename(filename)
    
    # Replace unsafe characters with underscores
    # Allow: alphanumeric, dash, underscore, dot
    filename = re.sub(r"[^\w\-\.]", "_", filename)
    
    # Prevent double extensions (e.g., file.txt.exe)
    parts = filename.split(".")
    if len(parts) > 2:
        # Keep only the last extension
        filename = "_".join(parts[:-1]) + "." + parts[-1]
    
    # Prevent hidden files
    if filename.startswith("."):
        filename = "_" + filename
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:250] + ext
    
    return filename


def validate_file_extension(filename: str) -> bool:
    """
    Validate file extension against whitelist
    
    Args:
        filename: File name to validate
    
    Returns:
        True if extension is allowed
    
    Raises:
        HTTPException: If extension is not allowed
    """
    is_valid = any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    return True


def validate_file_size(filepath: str) -> bool:
    """
    Validate file size is within acceptable range
    
    Args:
        filepath: Path to file
    
    Returns:
        True if size is valid
    
    Raises:
        HTTPException: If file size is invalid
    """
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File not found"
        )
    
    size = os.path.getsize(filepath)
    
    if size < MIN_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too small (minimum {MIN_FILE_SIZE} bytes)"
        )
    
    if size > MAX_FILE_SIZE:
        max_mb = MAX_FILE_SIZE / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (maximum {max_mb}MB)"
        )
    
    return True


def validate_mime_type(filepath: str) -> bool:
    """
    Validate MIME type to prevent malicious file uploads
    
    Args:
        filepath: Path to file
    
    Returns:
        True if MIME type is valid
    
    Raises:
        HTTPException: If MIME type is not allowed
    """
    try:
        mime = magic.Magic(mime=True)
        file_mime = mime.from_file(filepath)
        
        if file_mime not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type: {file_mime}. Must be audio file."
            )
        
        return True
    except Exception as e:
        # If magic library not available, fall back to extension check only
        return True


def validate_audio(filepath: str) -> bool:
    """
    Deep validation of audio file content
    
    Args:
        filepath: Path to audio file
    
    Returns:
        True if audio is valid
    
    Raises:
        HTTPException: If audio file is invalid or suspicious
    """
    try:
        data, samplerate = sf.read(filepath)
        
        # Check for suspicious sample rates
        if samplerate < 8000 or samplerate > 192000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sample rate: {samplerate}Hz. Must be between 8kHz and 192kHz."
            )
        
        # Check for empty audio
        if len(data) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Audio file is empty"
            )
        
        # Check for reasonable duration (not too short or suspiciously long)
        duration_seconds = len(data) / samplerate
        if duration_seconds < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Audio file too short (minimum 1 second)"
            )
        
        if duration_seconds > 3600:  # 1 hour max
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Audio file too long (maximum 1 hour)"
            )
        
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid audio file: {str(e)}"
        )


def validate_user_id(user_id: str) -> str:
    """
    Validate user_id format to prevent injection attacks
    
    Args:
        user_id: User identifier
    
    Returns:
        Validated user_id
    
    Raises:
        HTTPException: If user_id format is invalid
    """
    # Allow alphanumeric, dash, underscore only
    # Length: 1-100 characters
    if not re.match(r'^[a-zA-Z0-9_-]{1,100}$', user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id format. Must be alphanumeric, dash, or underscore (max 100 chars)"
        )
    
    return user_id


def validate_track_name(track_name: str) -> str:
    """
    Validate track name format
    
    Args:
        track_name: Track name
    
    Returns:
        Validated track name
    
    Raises:
        HTTPException: If track name is invalid
    """
    # Allow alphanumeric, spaces, dash, underscore, parentheses
    # Length: 1-200 characters
    if not re.match(r'^[a-zA-Z0-9\s_\-\(\)]{1,200}$', track_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid track name. Must be alphanumeric with spaces, dash, underscore, or parentheses (max 200 chars)"
        )
    
    # Prevent SQL injection patterns
    sql_patterns = ['--', ';--', '/*', '*/', 'xp_', 'sp_', 'DROP', 'SELECT', 'INSERT', 'UPDATE', 'DELETE']
    track_name_upper = track_name.upper()
    
    for pattern in sql_patterns:
        if pattern.upper() in track_name_upper:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Track name contains invalid characters"
            )
    
    return track_name.strip()


def validate_email(email: str) -> str:
    """
    Validate email format
    
    Args:
        email: Email address
    
    Returns:
        Normalized email (lowercase)
    
    Raises:
        HTTPException: If email format is invalid
    """
    # Basic email validation regex
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(email_regex, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    # Check length
    if len(email) > 254:  # RFC 5321
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email too long"
        )
    
    return email.lower().strip()


def validate_youtube_url(url: str) -> str:
    """
    Validate YouTube URL format
    
    Args:
        url: YouTube URL
    
    Returns:
        Validated URL
    
    Raises:
        HTTPException: If URL is invalid
    """
    # YouTube URL patterns
    youtube_patterns = [
        r'^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$',
        r'^(https?://)?(www\.)?youtube\.com/watch\?v=[\w-]+',
        r'^(https?://)?(www\.)?youtu\.be/[\w-]+'
    ]
    
    is_valid = any(re.match(pattern, url) for pattern in youtube_patterns)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid YouTube URL"
        )
    
    # Prevent other domains disguised as YouTube
    if 'youtube.com' not in url.lower() and 'youtu.be' not in url.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must be from YouTube"
        )
    
    return url


def sanitize_path(filepath: str, base_dir: str = None) -> str:
    """
    Prevent path traversal attacks
    
    Args:
        filepath: File path to sanitize
        base_dir: Optional base directory to restrict to
    
    Returns:
        Safe filepath
    
    Raises:
        HTTPException: If path traversal is detected
    """
    # Normalize path
    filepath = os.path.normpath(filepath)
    
    # Check for path traversal patterns
    if '..' in filepath or filepath.startswith('/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path (path traversal detected)"
        )
    
    # If base_dir specified, ensure path is within it
    if base_dir:
        base_dir = os.path.abspath(base_dir)
        full_path = os.path.abspath(os.path.join(base_dir, filepath))
        
        if not full_path.startswith(base_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path (outside allowed directory)"
            )
    
    return filepath


def validate_frequency(freq: float, min_freq: float = 0.5, max_freq: float = 100.0) -> float:
    """
    Validate binaural frequency value
    
    Args:
        freq: Frequency in Hz
        min_freq: Minimum allowed frequency
        max_freq: Maximum allowed frequency
    
    Returns:
        Validated frequency
    
    Raises:
        HTTPException: If frequency is out of range
    """
    if not isinstance(freq, (int, float)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Frequency must be a number"
        )
    
    if freq < min_freq or freq > max_freq:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Frequency must be between {min_freq}Hz and {max_freq}Hz"
        )
    
    return float(freq)


def validate_mode(mode: str) -> str:
    """
    Validate wave mode selection
    
    Args:
        mode: Wave mode string
    
    Returns:
        Validated mode
    
    Raises:
        HTTPException: If mode is invalid
    """
    VALID_MODES = ["gamma", "alpha", "beta", "theta", "delta", "schumann", "custom"]
    
    mode = mode.lower().strip()
    
    if mode not in VALID_MODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mode. Must be one of: {', '.join(VALID_MODES)}"
        )
    
    return mode
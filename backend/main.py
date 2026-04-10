import numpy as np
import soundfile as sf
import librosa
import shutil
import os
import sys
import yt_dlp
import re
import json
import uuid
import requests
import stripe
import time
import tempfile

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse
from datetime import datetime
from pydub import AudioSegment
from fastapi import Query
from dotenv import load_dotenv

# Import payment module
try:
    from backend import payment
    from backend.payment import calculate_price, MIN_PRICE_CENTS
except ImportError:
    import payment
    from payment import calculate_price, MIN_PRICE_CENTS

# Import wave configs
try:
    from backend.gamma import config as gamma
    from backend.alpha import config as alpha
    from backend.beta import config as beta
    from backend.theta import config as theta
    from backend.delta import config as delta
    from backend.schumann_resonance import config as schumann
except ImportError:
    from gamma import config as gamma
    from alpha import config as alpha
    from beta import config as beta
    from theta import config as theta
    from delta import config as delta
    from schumann_resonance import config as schumann

# Import security modules
try:
    from backend.auth import (
        verify_token, 
        get_current_user_id, 
        verify_admin,
        create_access_token,
        hash_password,
        verify_password
    )
    from backend.cyber_prevention import (
        sanitize_filename,
        validate_file_extension,
        validate_file_size,
        validate_audio,
        validate_user_id,
        validate_track_name,
        validate_email,
        validate_youtube_url,
        validate_mode,
        validate_frequency
    )
    from backend.middleware.rate_limit import rate_limiter, apply_endpoint_limit
    from backend.logging_config import (
        logger,
        log_security_event,
        log_access,
        log_error,
        log_file_operation,
        log_payment_event,
        security_monitor
    )
    from backend.webhooks import handle_stripe_webhook
except ImportError:
    # Running from backend directory
    from auth import (
        verify_token, 
        get_current_user_id, 
        verify_admin,
        create_access_token,
        hash_password,
        verify_password
    )
    from cyber_prevention import (
        sanitize_filename,
        validate_file_extension,
        validate_file_size,
        validate_audio,
        validate_user_id,
        validate_track_name,
        validate_email,
        validate_youtube_url,
        validate_mode,
        validate_frequency
    )
    from middleware.rate_limit import rate_limiter, apply_endpoint_limit
    from logging_config import (
        logger,
        log_security_event,
        log_access,
        log_error,
        log_file_operation,
        log_payment_event,
        security_monitor
    )
    from webhooks import handle_stripe_webhook

# --------------------
# Global files & folders
# --------------------
load_dotenv()

# Determine base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.basename(os.getcwd()) == "backend":
    BASE_DIR = os.path.dirname(os.getcwd())

LIBRARY_FILE = os.path.join(BASE_DIR, "music_library.json")
LIBRARY_FOLDER = os.path.join(BASE_DIR, "music_library")
TRACK_FILE = os.path.join(BASE_DIR, "track_event.json")
USER_LIBRARY_FILE = os.path.join(BASE_DIR, "user_library.json")
PLAYLISTS_FILE = os.path.join(BASE_DIR, "playlists.json")
SUBS_FILE = os.path.join(BASE_DIR, "user_subscriptions.json")
FREE_USERS_FILE = os.path.join(BASE_DIR, "free_users.json")
CURATED_FILE = os.path.join(BASE_DIR, "curated_playlists.json")
COMMUNITY_FILE = os.path.join(BASE_DIR, "community_uploads.json")
COMMUNITY_FOLDER = os.path.join(BASE_DIR, "community_library")
CREATOR_ACCOUNTS_FILE = os.path.join(BASE_DIR, "creator_accounts.json")
LOGS_DIR = os.path.join(BASE_DIR, "logs")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
MIN_PRICE_CENTS = 170

# Create necessary directories
os.makedirs(LIBRARY_FOLDER, exist_ok=True)
os.makedirs(COMMUNITY_FOLDER, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)

# Initialize JSON files
if not os.path.exists(PLAYLISTS_FILE):
    with open(PLAYLISTS_FILE, "w") as f:
        f.write("{}")

if not os.path.exists(TRACK_FILE):
    with open(TRACK_FILE, "w") as f:
        f.write("[]")

if not os.path.exists(SUBS_FILE):
    with open(SUBS_FILE, "w") as f:
        f.write("{}")

if not os.path.exists(USER_LIBRARY_FILE):
    with open(USER_LIBRARY_FILE, "w") as f:
        f.write("{}")

if not os.path.exists(FREE_USERS_FILE):
    with open(FREE_USERS_FILE, "w") as f:
        json.dump([], f)

# --------------------
# FastAPI setup
# --------------------
app = FastAPI(title="Soundara API", version="1.0.0")

# Load allowed origins from environment
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://soundara.co").split(",")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted host middleware
# NOTE: do not include "*" here — it makes the middleware a no-op.
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["soundara.co", "www.soundara.co", "localhost", "127.0.0.1"]
)

# Load free users
try:
    with open(FREE_USERS_FILE, "r") as f:
        FREE_USERS = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    FREE_USERS = []
    with open(FREE_USERS_FILE, "w") as f:
        json.dump(FREE_USERS, f)

# --------------------
# Wave mode configs
# --------------------
WAVE_MODES = {
    "gamma": gamma,
    "alpha": alpha,
    "beta": beta,
    "theta": theta,
    "delta": delta,
    "schumann": schumann,
}

# --------------------
# Middleware
# --------------------

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # HTTPS enforcement in production
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://js.stripe.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.stripe.com;"
    )
    
    return response


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Apply rate limiting to all requests"""
    start_time = time.time()
    
    try:
        # Check rate limit
        await rate_limiter.check_rate_limit(request)
        
        # Process request
        response = await call_next(request)
        
        # Calculate response time
        process_time = (time.time() - start_time) * 1000
        
        # Log access
        log_access(
            method=request.method,
            endpoint=str(request.url.path),
            ip_address=request.client.host if request.client else None,
            status_code=response.status_code,
            response_time_ms=process_time
        )
        
        return response
        
    except HTTPException as e:
        # Log rate limit exceeded
        log_security_event(
            event_type="rate_limit_exceeded",
            severity="medium",
            ip_address=request.client.host if request.client else None,
            details={
                "endpoint": str(request.url.path),
                "method": request.method
            }
        )
        raise


# --------------------
# DSP / Audio functions
# --------------------

def check_subscription(user_id: str):
    """
    Returns subscription info for a user:
    - None if no active subscription
    - dict with {'type': 'limited' or 'unlimited', 'remaining': int} if active
    """
    if not os.path.exists(SUBS_FILE):
        return None

    with open(SUBS_FILE, "r") as f:
        subs = json.load(f)

    sub = subs.get(user_id)
    if not sub:
        return None

    return sub


def make_binaural_from_file(path: str, freq_shift_hz: float):
    data, sr = sf.read(path, dtype="float32")
    if data.ndim == 2:
        mono = np.mean(data, axis=1, dtype=np.float32)
    else:
        mono = data
    semitones = 12 * np.log2(1 + freq_shift_hz / sr)
    shifted = librosa.effects.pitch_shift(
        y=mono, sr=sr, n_steps=semitones, res_type="polyphase"
    )
    min_len = min(len(mono), len(shifted))
    mono = mono[:min_len]
    shifted = shifted[:min_len]
    stereo = np.column_stack([mono, shifted])
    return stereo, sr


def create_preview(full_path, preview_path, seconds=7):
    audio = AudioSegment.from_file(full_path)
    preview = audio[:seconds * 1000]
    preview.export(preview_path, format="wav")


def get_audio_file(track, user_has_paid):
    if track["is_binaural"] and not user_has_paid:
        return track["filename_preview"]
    return track["filename_full"]


def add_to_library(track_name: str, full_path: str, mode: str, custom_freqs=None):
    """
    Stores a processed track in the library folder, generates a preview,
    and saves metadata in LIBRARY_FILE.
    Returns dict with filenames for frontend.
    """
    # Load existing library
    if os.path.exists(LIBRARY_FILE):
        with open(LIBRARY_FILE, "r") as f:
            library = json.load(f)
    else:
        library = []

    # Safe track name for filenames
    safe_name = re.sub(r"[^\w\-]", "_", track_name)
    timestamp_str = datetime.now().strftime('%Y%m%d%H%M%S')

    # Preview filename
    preview_filename = f"preview_{safe_name}_{timestamp_str}.wav"
    preview_path = os.path.join(LIBRARY_FOLDER, preview_filename)

    # Generate 7-second preview
    create_preview(full_path, preview_path, seconds=7)

    # Move full file into library folder (if not already there)
    final_full_path = os.path.join(LIBRARY_FOLDER, os.path.basename(full_path))
    if os.path.abspath(full_path) != os.path.abspath(final_full_path):
        shutil.move(full_path, final_full_path)

    # Save entry in library.json
    library_entry = {
        "name": track_name,
        "filename_full": os.path.basename(final_full_path),
        "filename_preview": preview_filename,
        "mode": mode,
        "is_binaural": True,
        "custom_freqs": custom_freqs,
        "size_bytes": os.path.getsize(final_full_path),
        "timestamp": datetime.now().isoformat(),
        "plays": 0
    }
    library.append(library_entry)

    with open(LIBRARY_FILE, "w") as f:
        json.dump(library, f, indent=2)

    # Return info needed for frontend immediately
    return {
        "filename_full": os.path.basename(final_full_path),
        "filename_preview": preview_filename,
        "size_bytes": library_entry["size_bytes"],
        "custom_freqs": custom_freqs
    }


def download_youtube_audio(url: str, output_path: str):
    # Use a private tmpdir so concurrent downloads don't collide on a shared
    # filename, and so we never write into the process CWD.
    tmpdir = tempfile.mkdtemp(prefix="yt_")
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(tmpdir, 'audio.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
        }
        # Only override ffmpeg_location if the env var is explicitly set.
        # Otherwise let yt-dlp find ffmpeg on PATH (works on Linux servers).
        ffmpeg_location = os.getenv('FFMPEG_PATH')
        if ffmpeg_location:
            ydl_opts['ffmpeg_location'] = ffmpeg_location

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        wav_path = os.path.join(tmpdir, 'audio.wav')
        if not os.path.exists(wav_path):
            raise RuntimeError("Failed to download YouTube audio.")
        shutil.move(wav_path, output_path)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# --------------------
# API Endpoints
# --------------------

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "Soundara API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/user_playlists/{user_id}")
async def get_user_playlists(user_id: str):
    """Get user's playlists"""
    user_id = validate_user_id(user_id)
    
    with open(PLAYLISTS_FILE, "r") as f:
        data = json.load(f)
    return data.get(user_id, {"default": []})


@app.post("/user_playlists/{user_id}")
async def save_user_playlists(user_id: str, request: Request):
    """Save user's playlists"""
    user_id = validate_user_id(user_id)
    
    data = await request.json()
    with open(PLAYLISTS_FILE, "r") as f:
        all_playlists = json.load(f)
    all_playlists[user_id] = data
    with open(PLAYLISTS_FILE, "w") as f:
        json.dump(all_playlists, f, indent=2)
    return {"status": "ok"}


@app.get("/library/")
async def get_library():
    """Get public library of tracks"""
    try:
        with open(LIBRARY_FILE, "r") as f:
            return json.load(f)
    except:
        return []


@app.get("/user_library/{user_id}")
async def get_user_library(user_id: str):
    """Get user's purchased library"""
    user_id = validate_user_id(user_id)
    
    with open(USER_LIBRARY_FILE, "r") as f:
        data = json.load(f)
    return data.get(user_id, [])


@app.post("/user_library/{user_id}/add")
async def add_to_user_library(user_id: str, request: Request):
    """Add track to user's library"""
    user_id = validate_user_id(user_id)
    
    data = await request.json()
    
    with open(USER_LIBRARY_FILE, "r") as f:
        library_data = json.load(f)
    
    if user_id not in library_data:
        library_data[user_id] = []
    
    library_data[user_id].append(data)
    
    with open(USER_LIBRARY_FILE, "w") as f:
        json.dump(library_data, f, indent=2)
    
    return {"status": "ok"}

@app.get("/library/file/{filename}")
async def get_audio_file_endpoint(filename: str):
    safe = sanitize_filename(filename)
    library_root = os.path.abspath(LIBRARY_FOLDER)
    path = os.path.abspath(os.path.join(library_root, safe))

    # Reject anything that escapes the library folder
    if os.path.dirname(path) != library_root:
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(path, media_type="audio/wav", filename=safe)


@app.post("/process_audio/")
async def process_audio(
    request: Request,
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    track_name: str = Form(...),
    mode: str = Form(...),
    custom_freq_hz: Optional[float] = Form(None),
):
    """
    Process audio file with binaural beats
    """
    if not file and not url:
        return {"status": "error", "message": "No input provided"}

    client_ip = request.client.host if request.client else "unknown"
    
    # Apply endpoint-specific rate limit
    await apply_endpoint_limit("/process_audio/", client_ip)
    
    # Validate inputs
    track_name = validate_track_name(track_name)
    mode = validate_mode(mode)
    
    tmp_path = None
    
    try:
        # Handle file upload or YouTube URL
        if file:
            # Validate file
            validate_file_extension(file.filename)
            
            # Save uploaded file temporarily — uuid prefix prevents
            # collisions between concurrent uploads of the same filename.
            tmp_path = os.path.join(
                BASE_DIR,
                f"temp_{uuid.uuid4().hex}_{sanitize_filename(file.filename)}",
            )
            with open(tmp_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            # Validate file size and content
            validate_file_size(tmp_path)
            validate_audio(tmp_path)
            
            log_file_operation(
                operation="upload",
                filename=file.filename,
                file_size_bytes=os.path.getsize(tmp_path),
                success=True
            )
            
        elif url:
            # Validate YouTube URL
            url = validate_youtube_url(url)

            tmp_path = os.path.join(BASE_DIR, f"temp_youtube_{uuid.uuid4().hex}.wav")
            try:
                download_youtube_audio(url, tmp_path)
                validate_audio(tmp_path)
            except Exception as e:
                log_error(
                    error_type="youtube_download_failed",
                    error_message=str(e),
                    endpoint="/process_audio/"
                )
                raise HTTPException(status_code=400, detail=f"YouTube download failed: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="No file or URL provided")

        # Process binaural
        if custom_freq_hz is not None:
            freq = validate_frequency(custom_freq_hz)
        else:
            config = WAVE_MODES[mode] if mode in WAVE_MODES else None
            freq = getattr(config, "FIXED_DIFF", config.DEFAULT_DIFF) if config else 0
        output, sr = make_binaural_from_file(tmp_path, freq)

        # Prepare safe filenames
        safe_name = re.sub(r"[^\w\-]", "_", track_name)
        full_filename = f"processed_{safe_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.wav"
        full_path = os.path.join(LIBRARY_FOLDER, full_filename)

        # Save full processed file
        sf.write(full_path, output, sr)

        # Add to library (creates preview automatically)
        stored_files = add_to_library(track_name, full_path, mode, custom_freqs=custom_freq_hz)
        
        log_file_operation(
            operation="process",
            filename=full_filename,
            file_size_bytes=os.path.getsize(full_path),
            success=True
        )

        # Return exact filenames to frontend
        return {
            "status": "success",
            "track": track_name,
            "mode": mode,
            "filename_full": stored_files["filename_full"],
            "filename_preview": stored_files["filename_preview"],
            "size_bytes": os.path.getsize(full_path)
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error(
            error_type="processing_error",
            error_message=str(e),
            endpoint="/process_audio/"
        )
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    
    finally:
        # Clean up temporary uploaded or downloaded file
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


# ===== CURATED PLAYLISTS =====

@app.get("/curated_playlists/")
async def get_curated_playlists():
    """Return curated playlists with tracks grouped by mode"""
    # Load curated config
    if not os.path.exists(CURATED_FILE):
        return {}
    with open(CURATED_FILE, "r") as f:
        curated = json.load(f)

    # Load library
    if not os.path.exists(LIBRARY_FILE):
        return {}
    with open(LIBRARY_FILE, "r") as f:
        library = json.load(f)

    result = {}
    for name, config in curated.items():
        tracks = [t for t in library if t.get("mode") in config["modes"]]
        result[name] = {
            "description": config["description"],
            "tracks": tracks
        }
    return result


# ===== SEARCH =====

@app.get("/search/")
async def search_tracks(q: str = Query("", max_length=200), mode: Optional[str] = Query(None)):
    """Search tracks by name and optionally filter by mode"""
    if not os.path.exists(LIBRARY_FILE):
        return []
    with open(LIBRARY_FILE, "r") as f:
        library = json.load(f)

    q_lower = q.lower().strip()
    results = []
    for track in library:
        if q_lower and q_lower not in track.get("name", "").lower():
            continue
        if mode and track.get("mode") != mode.lower():
            continue
        results.append(track)

    results.sort(key=lambda t: t.get("plays", 0), reverse=True)
    return results


# ===== COMMUNITY UPLOADS =====

VALID_GENRES = ["ambient", "electronic", "lo-fi", "classical", "meditation", "nature", "hip-hop", "rock", "pop", "other"]

@app.post("/community/upload/")
async def community_upload(
    request: Request,
    file: UploadFile = File(...),
    track_name: str = Form(...),
    artist_name: str = Form(...),
    genre: str = Form(...),
    description: str = Form(""),
    user_id: str = Form(...),
):
    """Upload original content for community sharing"""
    client_ip = request.client.host if request.client else "unknown"
    await apply_endpoint_limit("/upload/original/", client_ip)

    # Validate inputs
    track_name = validate_track_name(track_name)
    user_id = validate_user_id(user_id)
    genre = genre.lower().strip()
    if genre not in VALID_GENRES:
        raise HTTPException(status_code=400, detail=f"Invalid genre. Must be one of: {', '.join(VALID_GENRES)}")
    description = description[:500].strip()

    # Validate file
    validate_file_extension(file.filename)
    tmp_path = os.path.join(
        BASE_DIR,
        f"temp_community_{uuid.uuid4().hex}_{sanitize_filename(file.filename)}",
    )
    try:
        with open(tmp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        validate_file_size(tmp_path)
        validate_audio(tmp_path)

        # Save to community library
        track_id = str(uuid.uuid4())
        safe_name = re.sub(r"[^\w\-]", "_", track_name)
        timestamp_str = datetime.now().strftime('%Y%m%d%H%M%S')
        community_filename = f"community_{safe_name}_{timestamp_str}.wav"
        community_path = os.path.join(COMMUNITY_FOLDER, community_filename)

        # Convert to wav if needed
        data, sr = sf.read(tmp_path)
        sf.write(community_path, data, sr)

        # Generate preview
        preview_filename = f"community_preview_{safe_name}_{timestamp_str}.wav"
        preview_path = os.path.join(COMMUNITY_FOLDER, preview_filename)
        create_preview(community_path, preview_path, seconds=7)

        # Save metadata
        if os.path.exists(COMMUNITY_FILE):
            with open(COMMUNITY_FILE, "r") as f:
                uploads = json.load(f)
        else:
            uploads = []

        entry = {
            "id": track_id,
            "name": track_name,
            "artist": artist_name[:100],
            "artist_id": user_id,
            "genre": genre,
            "description": description,
            "filename": community_filename,
            "filename_preview": preview_filename,
            "size_bytes": os.path.getsize(community_path),
            "timestamp": datetime.now().isoformat(),
            "plays": 0,
            "status": "pending",
            "is_binaural": False
        }
        uploads.append(entry)
        with open(COMMUNITY_FILE, "w") as f:
            json.dump(uploads, f, indent=2)

        return {"status": "success", "track_id": track_id, "message": "Track uploaded and pending review"}

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/community/")
async def get_community_tracks():
    """List approved community tracks"""
    if not os.path.exists(COMMUNITY_FILE):
        return []
    with open(COMMUNITY_FILE, "r") as f:
        uploads = json.load(f)
    return [t for t in uploads if t.get("status") == "approved"]


@app.get("/community/all/{user_id}")
async def get_user_community_tracks(user_id: str):
    """Get all tracks uploaded by a specific user (any status)"""
    user_id = validate_user_id(user_id)
    if not os.path.exists(COMMUNITY_FILE):
        return []
    with open(COMMUNITY_FILE, "r") as f:
        uploads = json.load(f)
    return [t for t in uploads if t.get("artist_id") == user_id]


@app.get("/community/file/{filename}")
async def serve_community_file(filename: str):
    """Serve community audio file"""
    safe = sanitize_filename(filename)
    path = os.path.join(COMMUNITY_FOLDER, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="audio/wav", filename=safe)


@app.post("/community/moderate/{track_id}")
async def moderate_community_track(track_id: str, request: Request):
    """Admin approve/reject community track"""
    _require_admin(request)
    body = await request.json()
    action = body.get("action", "").lower()
    if action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Action must be 'approved' or 'rejected'")

    if not os.path.exists(COMMUNITY_FILE):
        raise HTTPException(status_code=404, detail="No community uploads")
    with open(COMMUNITY_FILE, "r") as f:
        uploads = json.load(f)

    found = False
    for track in uploads:
        if track["id"] == track_id:
            track["status"] = action
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Track not found")

    with open(COMMUNITY_FILE, "w") as f:
        json.dump(uploads, f, indent=2)

    return {"status": "success", "track_id": track_id, "action": action}


# ===== CREATOR / STRIPE CONNECT =====

@app.post("/creator/onboard")
async def creator_onboard(request: Request):
    """Create Stripe Connect account for a creator"""
    body = await request.json()
    user_id = validate_user_id(body.get("user_id", ""))
    user_email = body.get("email", "")

    try:
        account = stripe.Account.create(
            type="express",
            email=user_email,
            capabilities={
                "transfers": {"requested": True},
            },
        )

        # Save to creator accounts
        if os.path.exists(CREATOR_ACCOUNTS_FILE):
            with open(CREATOR_ACCOUNTS_FILE, "r") as f:
                accounts = json.load(f)
        else:
            accounts = {}

        accounts[user_id] = {
            "stripe_account_id": account.id,
            "onboarded": False,
            "name": body.get("name", ""),
            "email": user_email
        }
        with open(CREATOR_ACCOUNTS_FILE, "w") as f:
            json.dump(accounts, f, indent=2)

        # Create onboarding link
        base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=f"{base_url}/creator",
            return_url=f"{base_url}/creator",
            type="account_onboarding",
        )

        return {"status": "success", "url": account_link.url}

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/creator/onboard/status/{user_id}")
async def creator_onboard_status(user_id: str):
    """Check if creator has completed Stripe Connect onboarding"""
    user_id = validate_user_id(user_id)
    if not os.path.exists(CREATOR_ACCOUNTS_FILE):
        return {"onboarded": False, "has_account": False}
    with open(CREATOR_ACCOUNTS_FILE, "r") as f:
        accounts = json.load(f)

    if user_id not in accounts:
        return {"onboarded": False, "has_account": False}

    account_id = accounts[user_id]["stripe_account_id"]
    try:
        account = stripe.Account.retrieve(account_id)
        is_onboarded = account.charges_enabled or account.details_submitted
        accounts[user_id]["onboarded"] = is_onboarded
        with open(CREATOR_ACCOUNTS_FILE, "w") as f:
            json.dump(accounts, f, indent=2)
        return {"onboarded": is_onboarded, "has_account": True}
    except stripe.error.StripeError:
        return {"onboarded": False, "has_account": True}


@app.get("/creator/dashboard/{user_id}")
async def creator_dashboard(user_id: str):
    """Get creator dashboard data"""
    user_id = validate_user_id(user_id)

    # Get creator's uploaded tracks
    if os.path.exists(COMMUNITY_FILE):
        with open(COMMUNITY_FILE, "r") as f:
            uploads = json.load(f)
        my_tracks = [t for t in uploads if t.get("artist_id") == user_id]
    else:
        my_tracks = []

    total_plays = sum(t.get("plays", 0) for t in my_tracks)

    # Check Stripe Connect balance if onboarded
    balance_available = 0
    balance_pending = 0
    if os.path.exists(CREATOR_ACCOUNTS_FILE):
        with open(CREATOR_ACCOUNTS_FILE, "r") as f:
            accounts = json.load(f)
        if user_id in accounts and accounts[user_id].get("onboarded"):
            try:
                balance = stripe.Balance.retrieve(
                    stripe_account=accounts[user_id]["stripe_account_id"]
                )
                for b in balance.available:
                    balance_available += b.amount
                for b in balance.pending:
                    balance_pending += b.amount
            except stripe.error.StripeError:
                pass

    return {
        "tracks": my_tracks,
        "total_plays": total_plays,
        "balance_available_cents": balance_available,
        "balance_pending_cents": balance_pending,
    }


@app.post("/create_community_checkout/")
async def create_community_checkout(request: Request):
    """Create checkout session for a community track with 70/30 split"""
    body = await request.json()
    track_id = body.get("track_id", "")
    user_id = body.get("user_id", "")
    user_email = body.get("user_email", "")

    user_id = validate_user_id(user_id)

    # Find the community track
    if not os.path.exists(COMMUNITY_FILE):
        raise HTTPException(status_code=404, detail="Track not found")
    with open(COMMUNITY_FILE, "r") as f:
        uploads = json.load(f)

    track = next((t for t in uploads if t["id"] == track_id and t["status"] == "approved"), None)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found or not approved")

    # Calculate price
    price_cents = calculate_price(track["size_bytes"])

    # Find creator's Stripe Connect account
    creator_id = track["artist_id"]
    if not os.path.exists(CREATOR_ACCOUNTS_FILE):
        raise HTTPException(status_code=400, detail="Creator has not set up payments")
    with open(CREATOR_ACCOUNTS_FILE, "r") as f:
        accounts = json.load(f)

    if creator_id not in accounts or not accounts[creator_id].get("onboarded"):
        raise HTTPException(status_code=400, detail="Creator has not completed payment setup")

    creator_stripe_id = accounts[creator_id]["stripe_account_id"]

    # 30% platform fee
    application_fee = int(price_cents * 0.30)

    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"{track['name']} by {track['artist']}"},
                    "unit_amount": price_cents,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{base_url}/success?track_id={track_id}&user={user_id}",
            cancel_url=f"{base_url}/tools",
            payment_intent_data={
                "application_fee_amount": application_fee,
                "transfer_data": {
                    "destination": creator_stripe_id,
                },
            },
            metadata={
                "user_id": user_id,
                "track_id": track_id,
                "type": "community_purchase"
            },
        )
        return {"url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/track_event/")
async def track_event(request: Request):
    """Track user events"""
    data = await request.json()
    data["timestamp"] = datetime.now().isoformat()

    with open(TRACK_FILE, "r") as f:
        events = json.load(f)
    events.append(data)
    with open(TRACK_FILE, "w") as f:
        json.dump(events, f, indent=2)

    if data.get("type") == "audio_play" and "track" in data:
        track_name = data["track"]
        if os.path.exists(LIBRARY_FILE):
            with open(LIBRARY_FILE, "r") as f:
                library = json.load(f)
            for track in library:
                if track["name"] == track_name:
                    track["plays"] = track.get("plays", 0) + 1
                    break
            with open(LIBRARY_FILE, "w") as f:
                json.dump(library, f, indent=2)

    return {"status": "ok"}


@app.post("/create_checkout_session/")
async def create_checkout_session(request: Request):
    """Create Stripe checkout session"""
    data = await request.json()
    
    try:
        logger.info("Checkout request received")

        track = data.get("track")
        user_id = data.get("user_id")
        user_email = data.get("user_email")

        if not track:
            raise HTTPException(status_code=400, detail="Missing track data")

        if not user_id:
            raise HTTPException(status_code=400, detail="User must be logged in")
        
        user_id = validate_user_id(user_id)
        if user_email:
            user_email = validate_email(user_email)

        # Free user bypass
        if user_email in FREE_USERS:
            logger.info(f"Free user detected: {user_email}")

            with open(USER_LIBRARY_FILE, "r") as f:
                library_data = json.load(f)

            if user_id not in library_data:
                library_data[user_id] = []

            library_data[user_id].append(track)

            with open(USER_LIBRARY_FILE, "w") as f:
                json.dump(library_data, f, indent=2)

            return {
                "url": None,
                "message": "Free user, track added to library",
                "track": track["name"]
            }

        # Paid checkout flow
        filename = track.get("filename_full") or track.get("filename") or track.get("file_full")
        if not filename:
            raise HTTPException(status_code=400, detail="Missing filename in track data")
        
        track_file_path = os.path.join(LIBRARY_FOLDER, filename)

        if not os.path.exists(track_file_path):
            raise HTTPException(status_code=400, detail="Track file not found")

        file_size_bytes = os.path.getsize(track_file_path)
        custom_mode = track.get("mode") not in WAVE_MODES
        price_cents = payment.calculate_price(file_size_bytes, custom_mode=custom_mode)

        logger.info(f"Calculated price (cents): {price_cents}")

        base_url = "https://soundara.co" if os.getenv("ENVIRONMENT") == "production" else "http://localhost:5173"

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": track["name"]
                    },
                    "unit_amount": price_cents
                },
                "quantity": 1
            }],
            mode="payment",
            success_url=f"{base_url}/success?user={user_id}&track={filename}",
            cancel_url=f"{base_url}/",
            metadata={
                "user_id": user_id,
                "track_name": track["name"]
            }
        )

        return {"url": session.url}

    except HTTPException:
        raise
    except Exception as e:
        log_error(
            error_type="checkout_session_error",
            error_message=str(e),
            user_id=data.get("user_id"),
            endpoint="/create_checkout_session/"
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create_subscription_session/")
async def create_subscription_session(request: Request):
    """Create subscription checkout session"""
    data = await request.json()
    
    user_id = data.get("user_id")
    plan = data.get("plan")

    if not user_id or not plan:
        raise HTTPException(status_code=400, detail="Missing user_id or plan")
    
    user_id = validate_user_id(user_id)

    PRICE_IDS = {
        "limited": os.getenv("STRIPE_PRICE_LIMITED", "price_123limited"),
        "unlimited": os.getenv("STRIPE_PRICE_UNLIMITED", "price_456unlimited")
    }

    try:
        base_url = "https://soundara.co" if os.getenv("ENVIRONMENT") == "production" else "http://localhost:5173"
        
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{
                "price": PRICE_IDS[plan],
                "quantity": 1
            }],
            success_url=f"{base_url}/success?user={user_id}&subscription={plan}",
            cancel_url=f"{base_url}/pricing",
            metadata={
                "user_id": user_id,
                "plan": plan
            }
        )
        return {"url": session.url}
    except Exception as e:
        log_error(
            error_type="subscription_session_error",
            error_message=str(e),
            user_id=user_id,
            endpoint="/create_subscription_session/"
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/user_subscriptions/{user_id}/add")
async def add_subscription(user_id: str, request: Request):
    """Add/update user subscription"""
    user_id = validate_user_id(user_id)
    
    data = await request.json()
    if os.path.exists(SUBS_FILE):
        with open(SUBS_FILE, "r") as f:
            subs = json.load(f)
    else:
        subs = {}

    subs[user_id] = data

    with open(SUBS_FILE, "w") as f:
        json.dump(subs, f, indent=2)

    return {"status": "ok"}


@app.get("/play/{track_name}")
async def play_track(track_name: str, user_id: str):
    """Play a track"""
    track_name = validate_track_name(track_name)
    user_id = validate_user_id(user_id)
    
    with open(LIBRARY_FILE, "r") as f:
        library = json.load(f)
    
    with open(USER_LIBRARY_FILE, "r") as f:
        user_library = json.load(f)
    user_tracks = user_library.get(user_id, [])

    with open(SUBS_FILE, "r") as f:
        subs = json.load(f)
    user_sub = subs.get(user_id)

    track = next((t for t in library if t["name"] == track_name), None)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    has_paid = any(t.get("name") == track_name for t in user_tracks)
    is_subscribed = False

    if user_sub:
        plan = user_sub.get("plan")
        tracks_used = user_sub.get("tracks_used", 0)
        if plan == "unlimited":
            is_subscribed = True
        elif plan == "limited" and tracks_used < 20:
            is_subscribed = True
            user_sub["tracks_used"] = tracks_used + 1
            with open(SUBS_FILE, "w") as f:
                json.dump(subs, f, indent=2)

    filename = get_audio_file(track, has_paid or is_subscribed)
    path = os.path.join(LIBRARY_FOLDER, filename)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(path, media_type="audio/wav", filename=filename)


@app.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook endpoint"""
    return await handle_stripe_webhook(request)


@app.get("/public/stats")
async def get_public_stats():
    """Get public platform stats for social proof"""
    try:
        with open(LIBRARY_FILE, "r") as f:
            library = json.load(f)
        with open(USER_LIBRARY_FILE, "r") as f:
            user_library = json.load(f)
        total_plays = sum(track.get("plays", 0) for track in library)
        return {
            "total_tracks": len(library),
            "total_users": len(user_library),
            "total_plays": total_plays,
        }
    except Exception:
        return {"total_tracks": 0, "total_users": 0, "total_plays": 0}


ADMIN_EMAIL = "trevorm.goodwill@gmail.com"
ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN")


def _require_admin(request: Request):
    """Constant-time check of the X-Admin-Token header against the env token."""
    if not ADMIN_API_TOKEN:
        # Fail closed: if the server isn't configured, no one is admin.
        raise HTTPException(status_code=503, detail="Admin API not configured")
    provided = request.headers.get("x-admin-token", "")
    import hmac
    if not hmac.compare_digest(provided, ADMIN_API_TOKEN):
        raise HTTPException(status_code=403, detail="Not authorized")


@app.get("/admin/stats")
async def get_admin_stats(request: Request):
    """Get full platform statistics (admin only)"""
    _require_admin(request)
    try:
        with open(LIBRARY_FILE, "r") as f:
            library = json.load(f)
        with open(USER_LIBRARY_FILE, "r") as f:
            user_library = json.load(f)
        with open(TRACK_FILE, "r") as f:
            events = json.load(f)
        with open(SUBS_FILE, "r") as f:
            subs = json.load(f)

        total_plays = sum(track.get("plays", 0) for track in library)

        # Event breakdown
        event_types = {}
        unique_visitors = set()
        daily_events = {}
        for ev in events:
            t = ev.get("type", "unknown")
            event_types[t] = event_types.get(t, 0) + 1
            if ev.get("id") or ev.get("user"):
                unique_visitors.add(ev.get("id") or ev.get("user"))
            date = ev.get("timestamp", "")[:10]
            if date:
                daily_events[date] = daily_events.get(date, 0) + 1

        # Recent events (last 50)
        recent_events = events[-50:][::-1]

        # Community uploads
        community_tracks = []
        if os.path.exists(COMMUNITY_FILE):
            with open(COMMUNITY_FILE, "r") as f:
                community_tracks = json.load(f)
        pending_uploads = [t for t in community_tracks if t.get("status") == "pending"]

        return {
            "total_tracks": len(library),
            "total_users": len(user_library),
            "total_plays": total_plays,
            "total_events": len(events),
            "unique_visitors": len(unique_visitors),
            "active_subscriptions": len(subs),
            "event_breakdown": event_types,
            "daily_events": daily_events,
            "recent_events": recent_events,
            "pending_uploads": pending_uploads,
            "library": library,
            "subscriptions": subs,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


FREE_TRIAL_FILE = os.path.join(BASE_DIR, "free_trials.json")
if not os.path.exists(FREE_TRIAL_FILE):
    with open(FREE_TRIAL_FILE, "w") as f:
        json.dump({}, f)

@app.get("/free_trial/{user_id}")
async def check_free_trial(user_id: str):
    """Check if user has used their free trial"""
    user_id = validate_user_id(user_id)
    with open(FREE_TRIAL_FILE, "r") as f:
        trials = json.load(f)
    return {"used": user_id in trials}

@app.post("/free_trial/{user_id}/claim")
async def claim_free_trial(user_id: str, request: Request):
    """Claim free trial — add track to user library for free"""
    user_id = validate_user_id(user_id)
    with open(FREE_TRIAL_FILE, "r") as f:
        trials = json.load(f)
    if user_id in trials:
        raise HTTPException(status_code=400, detail="Free trial already used")

    data = await request.json()
    track = data.get("track")
    if not track:
        raise HTTPException(status_code=400, detail="Missing track data")

    # Mark trial as used
    trials[user_id] = {"claimed_at": datetime.now().isoformat(), "track": track.get("name", "")}
    with open(FREE_TRIAL_FILE, "w") as f:
        json.dump(trials, f, indent=2)

    # Add track to user library
    with open(USER_LIBRARY_FILE, "r") as f:
        library_data = json.load(f)
    if user_id not in library_data:
        library_data[user_id] = []
    library_data[user_id].append(track)
    with open(USER_LIBRARY_FILE, "w") as f:
        json.dump(library_data, f, indent=2)

    return {"status": "ok", "message": "Free trial claimed! Track added to your library."}


SPOTIFY_TOKEN_CACHE = {"token": None, "expires_at": 0}

def get_spotify_token():
    """Get Spotify API token using client credentials flow"""
    if SPOTIFY_TOKEN_CACHE["token"] and time.time() < SPOTIFY_TOKEN_CACHE["expires_at"]:
        return SPOTIFY_TOKEN_CACHE["token"]

    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    import base64
    auth_str = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    resp = requests.post("https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        headers={"Authorization": f"Basic {auth_str}"})
    if resp.status_code == 200:
        data = resp.json()
        SPOTIFY_TOKEN_CACHE["token"] = data["access_token"]
        SPOTIFY_TOKEN_CACHE["expires_at"] = time.time() + data.get("expires_in", 3600) - 60
        return data["access_token"]
    return None


@app.get("/song_search")
async def song_search(q: str = Query("", max_length=200)):
    """Search for song titles using Spotify API + local library"""
    if not q or len(q) < 2:
        return []

    results = []

    # Spotify search
    token = get_spotify_token()
    if token:
        try:
            resp = requests.get("https://api.spotify.com/v1/search",
                params={"q": q, "type": "track", "limit": 8},
                headers={"Authorization": f"Bearer {token}"})
            if resp.status_code == 200:
                for item in resp.json().get("tracks", {}).get("items", []):
                    artist = item["artists"][0]["name"] if item.get("artists") else ""
                    results.append({
                        "title": item["name"],
                        "artist": artist,
                        "source": "spotify",
                    })
        except Exception:
            pass

    # Local library search
    q_lower = q.lower().strip()
    if os.path.exists(LIBRARY_FILE):
        with open(LIBRARY_FILE, "r") as f:
            library = json.load(f)
        for track in library:
            name = track.get("name", "")
            if q_lower in name.lower():
                results.append({"title": name, "artist": "", "source": "library"})

    return results[:10]



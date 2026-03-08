import numpy as np
import soundfile as sf
import librosa
import shutil
import os
import yt_dlp
import re
import json
import requests
import stripe

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from datetime import datetime
from pydub import AudioSegment
from fastapi import Query
from backend.payment import calculate_price, MIN_PRICE_CENTS
from backend.cyber_prevention import sanitize_filename, validate_file_extension, validate_file_size, validate_audio
from dotenv import load_dotenv

from backend import payment
from backend.gamma import config as gamma
from backend.alpha import config as alpha
from backend.beta import config as beta
from backend.theta import config as theta
from backend.delta import config as delta
from backend.schumann_resonance import config as schumann

# --------------------
# Global files & folders
# --------------------
load_dotenv()
LIBRARY_FILE = "music_library.json"
LIBRARY_FOLDER = "music_library"
TRACK_FILE = "track_event.json"
USER_LIBRARY_FILE = "user_library.json"
PLAYLISTS_FILE = "playlists.json"
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
SUBS_FILE = "user_subscriptions.json"
MIN_PRICE_CENTS = 170

os.makedirs(LIBRARY_FOLDER, exist_ok=True)

if not os.path.exists(PLAYLISTS_FILE):
    with open(PLAYLISTS_FILE, "w") as f:
        f.write("{}")

# Ensure track_event.json exists
if not os.path.exists(TRACK_FILE):
    with open(TRACK_FILE, "w") as f:
        f.write("[]")

if not os.path.exists(SUBS_FILE):
    with open(SUBS_FILE, "w") as f:
        f.write("{}")


if not os.path.exists(USER_LIBRARY_FILE):
    with open(USER_LIBRARY_FILE, "w") as f:
        f.write("{}")

# --------------------
# FastAPI setup
# --------------------
app = FastAPI()

origins = [
    "http://localhost:5173",
    "https://soundara.co"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

## call free users here
with open("free_users.json", "r") as f:
    FREE_USERS = json.load(f)

with open("free_users.json", "w") as f:
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
# DSP / Audio functions
# --------------------
def check_subscription(user_id: str):
    """
    Returns subscription info for a user:
    - None if no active subscription
    - dict with {'type': 'limited' or 'unlimited', 'remaining': int} if active
    """
    # For simplicity, we store subscription status locally
    # You can replace this with a proper DB or Stripe webhook handling
    SUB_FILE = "user_subscriptions.json"
    if not os.path.exists(SUB_FILE):
        return None

    with open(SUB_FILE, "r") as f:
        subs = json.load(f)

    sub = subs.get(user_id)
    if not sub:
        return None

    # Check if subscription is active (optional: check end date)
    return sub

def make_binaural_from_file(path: str, freq_shift_hz: float):
    data, sr = sf.read(path)
    if data.ndim == 2:
        mono = np.mean(data, axis=1)
    else:
        mono = data
    semitones = 12 * np.log2(1 + freq_shift_hz / sr)
    shifted = librosa.effects.pitch_shift(y=mono, sr=sr, n_steps=semitones)
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
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'temp_audio.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
        'ffmpeg_location': r'C:\Users\trevo\Downloads\ffmpeg\bin'
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    if os.path.exists('temp_audio.wav'):
        os.rename('temp_audio.wav', output_path)
    else:
        raise RuntimeError("Failed to download YouTube audio.")

# --------------------
# API Endpoints
# --------------------
@app.get("/user_playlists/{user_id}")
def get_user_playlists(user_id: str):
    with open(PLAYLISTS_FILE, "r") as f:
        data = json.load(f)
    return data.get(user_id, {"default": []})

@app.post("/user_playlists/{user_id}")
async def save_user_playlists(user_id: str, request: Request):
    data = await request.json()
    with open(PLAYLISTS_FILE, "r") as f:
        all_playlists = json.load(f)
    all_playlists[user_id] = data
    with open(PLAYLISTS_FILE, "w") as f:
        json.dump(all_playlists, f, indent=2)
    return {"status": "ok"}


@app.get("/library/")
def get_library():
    try:
        with open(LIBRARY_FILE, "r") as f:
            return json.load(f)
    except:
        return []

# Get a user's library
@app.get("/user_library/{user_id}")
def get_user_library(user_id: str):
    with open(USER_LIBRARY_FILE, "r") as f:
        data = json.load(f)
    return data.get(user_id, [])

# Add track to a user's library
@app.post("/user_library/{user_id}/add")
async def add_to_user_library(user_id: str, request: Request):
    data = await request.json()
    with open(USER_LIBRARY_FILE, "r") as f:
        library = json.load(f)
    if user_id not in library:
        library[user_id] = []
    library[user_id].append(data)
    with open(USER_LIBRARY_FILE, "w") as f:
        json.dump(library, f, indent=2)
    return {"status": "ok"}

@app.post("/user_subscriptions/{user_id}/activate")
async def activate_subscription(user_id: str, request: Request):
    data = await request.json()
    plan = data.get("plan")  # "limited" or "unlimited"
    if plan not in ["limited", "unlimited"]:
        return {"error": "Invalid plan"}

    with open(SUBS_FILE, "r") as f:
        subs = json.load(f)

    # Activate subscription for user
    subs[user_id] = {
        "plan": plan,
        "activated_at": datetime.now().isoformat(),
        "tracks_used": 0  # for limited plan
    }

    with open(SUBS_FILE, "w") as f:
        json.dump(subs, f, indent=2)

    return {"status": "ok"}

@app.get("/library/file/{filename}")
def get_library_file(filename: str):
    path = os.path.join(LIBRARY_FOLDER, filename)
    if not os.path.exists(path):
        return {"error": "File not found"}
    return FileResponse(path, media_type="audio/wav", filename=filename)

@app.post("/process_audio/")
async def process_audio(
    file: UploadFile = File(None),
    url: str = Form(None),
    mode: str = Form("alpha"),
    custom_freqs: str =Form(None),
    track_name: str = Form(...)
):
    user_freqs = None
    if custom_freqs:
        try:
            user_freqs = json.loads(custom_freqs)  # e.g., {"alpha": 10, "beta": -5}
        except json.JSONDecodeError:
            return {"error": "custom_freqs must be valid JSON"}

    # Validate mode
    if mode not in WAVE_MODES and not user_freqs:
        return {"error": f"Invalid mode: {mode}. Must be one of {WAVE_MODES} or provide custom_freqs."}

    tmp_path = None

    if mode not in WAVE_MODES:
        return {"error": f"Invalid mode: {mode}. Must be one of {WAVE_MODES}"}

    try:
        # Save uploaded file or download from URL
        if file:
            tmp_path = f"temp_{datetime.now().timestamp()}_{sanitize_filename(file.filename)}"
            with open(tmp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Cybersecurity checks
            if not validate_file_extension(tmp_path):
                return {"error": "Invalid file type"}
            if not validate_file_size(tmp_path):
                return {"error": "File too large"}
            if not validate_audio(tmp_path):
                return {"error": "Invalid or corrupted audio"}
        elif url:
            tmp_path = "temp_url_audio.wav"
            if re.search(r"(youtube\.com|youtu\.be)", url):
                download_youtube_audio(url, tmp_path)
            else:
                r = requests.get(url, stream=True)
                if r.status_code != 200:
                    return {"error": "Unable to download URL"}
                with open(tmp_path, "wb") as f:
                    for chunk in r.iter_content(1024):
                        f.write(chunk)
        else:
            return {"error": "No file or URL provided"}

        # Process binaural
        config = WAVE_MODES[mode] if mode in WAVE_MODES else None
        freq = getattr(config, "FIXED_DIFF", config.DEFAULT_DIFF) if config else 0
        output, sr = make_binaural_from_file(tmp_path, freq)

        #Prepare safe filenames
        safe_name = re.sub(r"[^\w\-]", "_", track_name)
        full_filename = f"processed_{safe_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.wav"
        full_path = os.path.join(LIBRARY_FOLDER, full_filename)

        # Save full processed file
        sf.write(full_path, output, sr)

        # Add to library (creates preview automatically)
        stored_files = add_to_library(track_name, full_path, mode, custom_freqs=user_freqs)

        # Return exact filenames to frontend
        return {
            "status": "success",
            "track": track_name,
            "mode": mode,
            "filename_full": stored_files["filename_full"],
            "filename_preview": stored_files["filename_preview"],
            "size_bytes": os.path.getsize(full_path),
            "custom_freqs": user_freqs or None
        }

    finally:
        # Clean up temporary uploaded or downloaded file
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

# --------------------
# Event tracking
# --------------------
@app.post("/track_event/")
async def track_event(request: Request):
    data = await request.json()
    data["timestamp"] = datetime.now().isoformat()

    # Log event to track_event.json
    with open(TRACK_FILE, "r") as f:
        events = json.load(f)
    events.append(data)
    with open(TRACK_FILE, "w") as f:
        json.dump(events, f, indent=2)

    # If it's a track play, increment the play count in music_library.json
    if data.get("type") == "audio_play" and "track" in data:
        track_name = data["track"]
        if os.path.exists(LIBRARY_FILE):
            with open(LIBRARY_FILE, "r") as f:
                library = json.load(f)
            for track in library:
                if track["name"] == track_name:
                    track["plays"] += 1
                    break
            with open(LIBRARY_FILE, "w") as f:
                json.dump(library, f, indent=2)

    return {"status": "ok"}

@app.post("/create_checkout_session/")
async def create_checkout_session(data: dict):
    try:
        print("Checkout request received:", data)

        track = data.get("track")
        user_id = data.get("user_id")
        user_email = data.get("user_email")
        print("LIBRARY_FOLDER:", LIBRARY_FOLDER)
        print("Track object:", track)
        print("filename_full:", track.get("filename_full"))
        print("Files in LIBRARY_FOLDER:", os.listdir(LIBRARY_FOLDER))

        if not track:
            return {"error": "Missing track data"}

        if not user_id:
            return {"error": "User must be logged in"}

        # -------------------------
        # Free user bypass
        # -------------------------
        if user_email in FREE_USERS:
            print("Free user detected:", user_email)

            with open(USER_LIBRARY_FILE, "r") as f:
                library_data = json.load(f)

            if user_id not in library_data:
                library_data[user_id] = []

            library_data[user_id].append(track)

            with open(USER_LIBRARY_FILE, "w") as f:
                json.dump(library_data, f, indent=2)

            print("Track added to free user library:", track["name"])

            return {
                "url": None,
                "message": "Free user, track added to library",
                "track": track["name"]
            }

        # -------------------------
        # Paid checkout flow
        # -------------------------
        print("Incoming track:", track)

        filename = track.get("filename_full") or track.get("filename") or track.get("file_full")
        if not filename:
            return {"error": "Missing filename in track data"}
        track_file_path = os.path.join(LIBRARY_FOLDER, filename)

        print("LIBRARY_FOLDER:", LIBRARY_FOLDER)
        print("filename:", filename)
        print("full path:", track_file_path)
        print("exists:", os.path.exists(track_file_path))

        if not os.path.exists(track_file_path):
            return {"error": "Track file not found"}

        file_size_bytes = os.path.getsize(track_file_path)

        custom_mode = track.get("mode") not in WAVE_MODES

        price_cents = payment.calculate_price(
            file_size_bytes,
            custom_mode=custom_mode
        )

        print("Calculated price (cents):", price_cents)

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
            success_url=f"http://localhost:5173/success?user={user_id}&track={filename}",
            cancel_url="http://localhost:5173/",
        )

        print("Stripe session created:", session.id)

        return {"url": session.url}

    except Exception as e:
        print("Error creating checkout session:", str(e))
        return {"error": str(e)}
    
@app.post("/create_subscription_session/")
async def create_subscription_session(data: dict):
    user_id = data.get("user_id")
    plan = data.get("plan")  # "limited" or "unlimited"

    if not user_id or not plan:
        return {"error": "Missing user_id or plan"}

    # Map plans to Stripe price IDs (create these in Stripe dashboard)
    PRICE_IDS = {
        "limited": "price_123limited",   # $12.99 / month, 20 tracks
        "unlimited": "price_456unlimited"  # $16.99 / month, unlimited
    }

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{
                "price": PRICE_IDS[plan],
                "quantity": 1
            }],
            success_url=f"http://localhost:5173/success?user={user_id}&subscription={plan}",
            cancel_url="http://localhost:5173/pricing"
        )
        return {"url": session.url}
    except Exception as e:
        print("Error creating subscription session:", e)
        return {"error": str(e)}
    
@app.post("/user_subscriptions/{user_id}/add")
async def add_subscription(user_id: str, request: Request):
    data = await request.json()
    SUB_FILE = "user_subscriptions.json"
    if os.path.exists(SUB_FILE):
        with open(SUB_FILE, "r") as f:
            subs = json.load(f)
    else:
        subs = {}

    subs[user_id] = data

    with open(SUB_FILE, "w") as f:
        json.dump(subs, f, indent=2)

    return {"status": "ok"}

@app.get("/play/{track_name}")
def play_track(track_name: str, user_id: str):
    # Load library
    with open(LIBRARY_FILE, "r") as f:
        library = json.load(f)
    
    # Load user's library
    with open(USER_LIBRARY_FILE, "r") as f:
        user_library = json.load(f)
    user_tracks = user_library.get(user_id, [])

    # Load user's subscription
    with open(SUBS_FILE, "r") as f:
        subs = json.load(f)
    user_sub = subs.get(user_id)

    # Find track in main library
    track = next((t for t in library if t["name"] == track_name), None)
    if not track:
        return {"error": "Track not found"}

    # Decide if user can access the full file
    has_paid = any(t.get("name") == track_name for t in user_tracks)
    is_subscribed = False

    if user_sub:
        plan = user_sub["plan"]
        if plan == "unlimited":
            is_subscribed = True
        elif plan == "limited" and user_sub["tracks_used"] < 20:
            is_subscribed = True
            # Increment usage for limited plan
            user_sub["tracks_used"] += 1
            with open(SUBS_FILE, "w") as f:
                json.dump(subs, f, indent=2)

    filename = get_audio_file(track, has_paid or is_subscribed)
    path = os.path.join(LIBRARY_FOLDER, filename)

    if not os.path.exists(path):
        return {"error": "File not found"}

    return FileResponse(path, media_type="audio/wav", filename=filename)
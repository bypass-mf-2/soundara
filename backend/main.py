import numpy as np
import soundfile as sf
import librosa
import shutil
import os
import yt_dlp
import re
import json
import requests

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from datetime import datetime

from backend.alpha import config as alpha
from backend.beta import config as beta
from backend.theta import config as theta
from backend.delta import config as delta
from backend.schumann_resonance import config as schumann

# --------------------
# Global files & folders
# --------------------
LIBRARY_FILE = "music_library.json"
LIBRARY_FOLDER = "music_library"
TRACK_FILE = "track_event.json"

os.makedirs(LIBRARY_FOLDER, exist_ok=True)

# Ensure track_event.json exists
if not os.path.exists(TRACK_FILE):
    with open(TRACK_FILE, "w") as f:
        f.write("[]")

# --------------------
# FastAPI setup
# --------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------
# Wave mode configs
# --------------------
WAVE_MODES = {
    "alpha": alpha,
    "beta": beta,
    "theta": theta,
    "delta": delta,
    "schumann": schumann,
}

# --------------------
# DSP / Audio functions
# --------------------
def make_binaural_from_file(path: str, freq_shift_hz: float):
    # Load audio
    data, sr = sf.read(path)

    # Convert to mono if stereo
    if data.ndim == 2:
        mono = np.mean(data, axis=1)
    else:
        mono = data

    # Hz difference → semitone fraction
    semitones = 12 * np.log2(1 + freq_shift_hz / sr)

    # Pitch shift
    shifted = librosa.effects.pitch_shift(
        y=mono,
        sr=sr,
        n_steps=semitones
    )

    # Match lengths
    min_len = min(len(mono), len(shifted))
    mono = mono[:min_len]
    shifted = shifted[:min_len]

    # Left = original, Right = shifted
    stereo = np.column_stack([mono, shifted])
    return stereo, sr

def add_to_library(track_name: str, out_path: str, mode: str):
    # Load existing library
    if os.path.exists(LIBRARY_FILE):
        with open(LIBRARY_FILE, "r") as f:
            library = json.load(f)
    else:
        library = []

    # Add new track
    library.append({
        "name": track_name,
        "file": os.path.basename(out_path),
        "mode": mode,
        "timestamp": datetime.now().isoformat()
    })

    # Save library
    with open(LIBRARY_FILE, "w") as f:
        json.dump(library, f, indent=2)

    # Move audio to library folder
    shutil.move(out_path, os.path.join(LIBRARY_FOLDER, os.path.basename(out_path)))

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
@app.get("/library/")
def get_library():
    if not os.path.exists(LIBRARY_FILE):
        return []
    with open(LIBRARY_FILE, "r") as f:
        library = json.load(f)
    return library

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
    track_name: str = Form(...)
):
    tmp_path = None
    try:
        # Handle file upload
        if file:
            tmp_path = f"temp_{datetime.now().timestamp()}_{file.filename}"
            with open(tmp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

        # Handle URL upload
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

        # Get frequency diff
        config = WAVE_MODES[mode]
        freq = getattr(config, "FIXED_DIFF", config.DEFAULT_DIFF)

        # Generate binaural audio
        output, sr = make_binaural_from_file(tmp_path, freq)

        # Write output
        safe_name = track_name.replace(" ", "_")
        out_path = f"processed_{safe_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.wav"
        sf.write(out_path, output, sr)
        add_to_library(track_name, out_path, mode)

        return {"status": "success", "track": track_name, "mode": mode}

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

# --------------------
# Event tracking
# --------------------
@app.post("/track_event/")
async def track_event(request: Request):
    """
    Save events like:
    - page visits
    - button clicks
    - track plays
    """
    data = await request.json()
    data["timestamp"] = datetime.now().isoformat()

    # Load existing events
    with open(TRACK_FILE, "r") as f:
        events = json.load(f)

    events.append(data)

    with open(TRACK_FILE, "w") as f:
        json.dump(events, f, indent=2)

    return {"status": "ok"}
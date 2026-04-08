// AudioPlayer.jsx
import { useEffect, useRef, useState} from "react";
import { usePlayer } from "../PlayerContext.jsx";
import { trackEvent } from "../track_event.js";
import BASE_URL from "../api.js";

export default function AudioPlayer() {
  const audioRef = useRef(null);
  const prevUrlRef = useRef("");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const {
    playlists,
    currentPlaylist,
    currentIndex,
    isPlaying,
    playTrack,
    pauseTrack,
    nextTrack,
    prevTrack,
    shuffle,
    toggleShuffle,
    repeat,
    toggleRepeat,
  } = usePlayer();

  const track = playlists[currentPlaylist]?.[currentIndex] || null;
  const audioUrl = track
    ? `${BASE_URL}/library/file/${track.filename_full}`
  : "";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track || !audioUrl) return;

    const trackChanged = audioUrl !== prevUrlRef.current;

    if (trackChanged) {
      prevUrlRef.current = audioUrl;
      audio.pause();
      audio.src = audioUrl;
      audio.load();
      setProgress(0);
      setDuration(0);

      if (isPlaying) {
        audio.oncanplay = () => {
          audio.oncanplay = null;
          audio.play().catch(() => {});
          trackEvent({ type: "audio_play", track: track.name });
        };
      }
    } else {
      if (isPlaying) {
        audio.play().catch(() => {});
        trackEvent({ type: "audio_play", track: track.name });
      } else {
        audio.pause();
      }
    }
  }, [audioUrl, isPlaying, track]);

  // Update progress as audio plays
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
  };

  // Seek when user drags the slider
  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = e.target.value;
    setProgress(e.target.value);
  };

  const handleEnded = () => nextTrack();

  // Format seconds → m:ss
  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!track) return null;

  return (
    <div className="audio-player-bar">
      <div className="track-info">
        {track.name} {track.mode && `(${track.mode})`} {track.artist && `- ${track.artist}`}
      </div>

      <div className="controls">
        <button onClick={prevTrack}>⏮</button>
        <button onClick={() => (isPlaying ? pauseTrack() : playTrack(currentIndex))}>
          {isPlaying ? "⏸" : "▶️"}
        </button>
        <button onClick={nextTrack}>⏭</button>
        <button onClick={toggleShuffle} style={{ opacity: shuffle ? 1 : 0.4 }}>🔀</button>
        <button onClick={toggleRepeat} style={{ opacity: repeat ? 1 : 0.4 }}>🔁</button>
              {/* Playlist name display */}
        <span style={{ fontSize: "12px", opacity: 0.6 }}>
          {currentPlaylist === "__library__" ? "Library" : currentPlaylist}
        </span>
      </div>

      <div className="seek-bar" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span>{formatTime(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={progress}
          onChange={handleSeek}
          style={{ flex: 1 }}
        />
        <span>{formatTime(duration)}</span>
      </div>

      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        style={{ display: "none" }}
      />
    </div>
  );
}
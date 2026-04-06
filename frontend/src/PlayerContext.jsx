// PlayerContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import BASE_URL from "./api.js";

const PlayerContext = createContext();
export const usePlayer = () => useContext(PlayerContext);

export function PlayerProvider({ children }) {
    const USER_ID = JSON.parse(localStorage.getItem("user"))?.id;


  const [playlists, setPlaylists] = useState({ default: [] });
  const [currentPlaylist, setCurrentPlaylist] = useState("default");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

// Load playlists from backend on login
  useEffect(() => {
    if (!USER_ID) return;
    fetch(`${BASE_URL}/user_playlists/${USER_ID}`)
      .then(res => res.json())
      .then(data => {
        if (data && Object.keys(data).length > 0) setPlaylists(data);
      })
      .catch(() => {});
  }, [USER_ID]);

  // Save playlists to backend whenever they change
  useEffect(() => {
    if (!USER_ID) return;
    fetch(`${BASE_URL}/user_playlists/${USER_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(playlists),
    }).catch(() => {});
  }, [playlists]);

  const addToPlaylist = (track, playlistName = currentPlaylist) => {
    setPlaylists(prev => {
      const pl = prev[playlistName] || [];
      if (pl.some(t => t.filename_full === track.filename_full)) return prev;
      return { ...prev, [playlistName]: [...pl, track] };
    });
  };

   const removeFromPlaylist = (filename_full, playlistName = currentPlaylist) => {
    setPlaylists(prev => ({
      ...prev,
      [playlistName]: (prev[playlistName] || []).filter(t => t.filename_full !== filename_full),
    }));
  };

  const createPlaylist = (name) => {
    if (!name || playlists[name]) return false;
    setPlaylists(prev => ({ ...prev, [name]: [] }));
    return true;
  };

  const deletePlaylist = (name) => {
    if (name === "default") return;
    setPlaylists(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
    if (currentPlaylist === name) setCurrentPlaylist("default");
  };

  const renamePlaylist = (oldName, newName) => {
    if (!newName || oldName === "default" || playlists[newName]) return false;
    setPlaylists(prev => {
      const updated = { ...prev };
      updated[newName] = updated[oldName];
      delete updated[oldName];
      return updated;
    });
    if (currentPlaylist === oldName) setCurrentPlaylist(newName);
    return true;
  };

  // Play entire library as a playlist
  const playLibrary = (tracks) => {
    setPlaylists(prev => ({ ...prev, __library__: tracks }));
    setCurrentPlaylist("__library__");
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  const playTrack = (index) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const pauseTrack = () => setIsPlaying(false);

  const nextTrack = () => {
    const pl = playlists[currentPlaylist] || [];
    if (!pl.length) return;
    if (shuffle) {
      setCurrentIndex(Math.floor(Math.random() * pl.length));
      setIsPlaying(true);
    } else if (currentIndex + 1 < pl.length) {
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(true);
    } else if (repeat) {
      setCurrentIndex(0);
      setIsPlaying(true);
    }
    // else: end of playlist with no repeat — stop playing
  };

  const prevTrack = () => {
    const pl = playlists[currentPlaylist] || [];
    if (!pl.length) return;
    if (currentIndex - 1 >= 0) {
      setCurrentIndex(currentIndex - 1);
      setIsPlaying(true);
    } else if (repeat) {
      setCurrentIndex(pl.length - 1);
      setIsPlaying(true);
    }
    // else: already at first track with no repeat — stop playing
  };

  const toggleShuffle = () => setShuffle(prev => !prev);
  const toggleRepeat = () => setRepeat(prev => !prev);

  return (
    <PlayerContext.Provider
      value={{
        playlists,
        currentPlaylist,
        setCurrentPlaylist,
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
        addToPlaylist,
        removeFromPlaylist,
        createPlaylist,
        deletePlaylist,
        renamePlaylist,
        playLibrary, 
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
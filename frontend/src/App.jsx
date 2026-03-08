import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Navbar from "./components/Navbar.jsx";
import Library from "./pages/Library-Playlist.jsx";
import Pricing from "./pages/Pricing.jsx";
import Future from "./pages/Envision.jsx";
import Success from "./pages/Success.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";
import DMCA from "./pages/DMCA.jsx";
import AudioPlayer from "./components/AudioPlayer.jsx";

import { usePlayer } from "./PlayerContext.jsx";
import { GoogleLogin, googleLogout } from "@react-oauth/google";
import {jwtDecode} from "jwt-decode";
import { trackEvent } from "./track_event.js";

export default function App() {
  const [user, setUser] = useState(null);
  const [library, setLibrary] = useState([]);

  // Pull playlist info from PlayerContext
  const {
    playlists,
    currentPlaylist,
    addToPlaylist: addTrackToContext,
  } = usePlayer();

  // Get current playlist tracks
  const playlistTracks = playlists[currentPlaylist] || [];

  // Helper to check if user bought a track
  const userHasBought = (track) => {
    if (!user) return false;
    return track.isPurchased || false;
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogout = () => {
    if (user) {
      trackEvent({
        type: "logout",
        name: user.name,
        email: user.email,
        id: user.id,
      });
    }
    googleLogout();
    setUser(null);
    localStorage.removeItem("user");
  };

// Wrap context addToPlaylist to include user check + tracking
const addToPlaylist = (track) => {
  if (!user) {
    console.warn("User not loaded yet. Cannot add to playlist.");
    return;
  }

  // Add track to context playlist (PlayerContext handles duplicates and localStorage)
  addTrackToContext(track);

  // Optional: track event
  trackEvent({
    type: "add_to_playlist",
    user: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    id: user.id,
    track: track.track,
  });
};

  // Force login if user not loaded
  if (!user) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Login to continue</h2>
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            const profile = jwtDecode(credentialResponse.credential);
            const userData = {
              name: profile.name,
              email: profile.email,
              picture: profile.picture,
              id: profile.sub,
            };
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
            trackEvent({
              type: "login",
              user: profile.sub,
              name: profile.name,
              picture: profile.picture,
            });
          }}
          onError={() => console.log("Login Failed")}
        />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Navbar user={user} onLogout={handleLogout} />
      {/* Audio player now gets tracks from PlayerContext */}
      <Routes>
        <Route
          path="/"
          element={
            <Home
              user={user}
              playlist={playlistTracks}
              addToPlaylist={addToPlaylist}
              library={library}
              setLibrary={setLibrary}
              onLogout={handleLogout}
            />
          }
        />
        <Route
          path="/library"
          element={
            <Library
              user={user}
              playlist={playlistTracks}
              addToPlaylist={addToPlaylist}
              library={library}
            />
          }
        />
        <Route
          path="/about"
          element={<About playlist={playlistTracks} addToPlaylist={addToPlaylist} library={library} />}
        />
        <Route path="/contact" element={<Contact playlist={playlistTracks} addToPlaylist={addToPlaylist} />} />
        <Route path="/pricing" element={<Pricing playlist={playlistTracks} addToPlaylist={addToPlaylist} />} />
        <Route path="/future" element={<Future playlist={playlistTracks} addToPlaylist={addToPlaylist} />} />
        <Route path="/success" element={<Success />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/dmca" element={<DMCA />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <AudioPlayer playlist={playlistTracks} userHasBought={userHasBought} />
    </BrowserRouter>
  );
}
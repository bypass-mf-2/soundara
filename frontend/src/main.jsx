import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx"; 
import "./index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { PlayerProvider } from "./PlayerContext.jsx";

const clientId = "94161908180-11qit6o22k1nn0v6dhg583upvhqqhl16.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <PlayerProvider>
        <App />
      </PlayerProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
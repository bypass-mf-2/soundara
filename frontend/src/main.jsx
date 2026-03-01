import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx"; 
import "./index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Replace with your actual client ID
const clientId = "YOUR_GOOGLE_CLIENT_ID";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
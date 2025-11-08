// user-app/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Toastify
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Icons
import "@fortawesome/fontawesome-free/css/all.min.css";

// Google OAuth
import { GoogleOAuthProvider } from "@react-oauth/google";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
if (!clientId) {
  // Giúp debug nhanh nếu quên .env
  console.warn("[GoogleOAuth] Missing VITE_GOOGLE_CLIENT_ID in client .env");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
      <ToastContainer position="top-right" autoClose={2200} />
    </GoogleOAuthProvider>
  </React.StrictMode>
);

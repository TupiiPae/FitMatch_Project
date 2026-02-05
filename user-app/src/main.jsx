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
  console.warn("[GoogleOAuth] Missing VITE_GOOGLE_CLIENT_ID in client .env");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
      <ToastContainer position="bottom-center" autoClose={2200} hideProgressBar closeButton={false} newestOnTop={false} closeOnClick pauseOnFocusLoss draggable pauseOnHover limit={3} theme="dark" toastClassName="fm-toast" bodyClassName="fm-toast-body" style={{ marginBottom: "calc(12px + env(safe-area-inset-bottom))" }} />
    </GoogleOAuthProvider>
  </React.StrictMode>
);

import React from "react";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import "./Navbar.css";
import "./Footer.css";
import ScrollTopButton from "../ScrollTopButton.jsx";

import AiChatFloat from "../AiChatFloat/AiChatFloat.jsx"; 

export default function AppShell({ nickname = "Bạn", meId, children }) {
  return (
    <div className="fm-root">
      <Navbar nickname={nickname} />
      <main className="fm-main">{children}</main>
      <Footer />
      <ScrollTopButton />
      <AiChatFloat meId={meId} nickname={nickname} /> 
    </div>
  );
}

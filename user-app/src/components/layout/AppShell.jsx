import React from "react";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import "./Navbar.css";
import "./Footer.css";

import ScrollTopButton from "../ScrollTopButton.jsx";

export default function AppShell({ nickname = "Bạn", children }) {
  return (
    <div className="fm-root">
      <Navbar nickname={nickname} />
      <main className="fm-main">{children}</main>
      <Footer />
      <ScrollTopButton />
    </div>
  );
}
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles.css";
import { applyAppearance } from "./ui/appearance";
applyAppearance();
// Offline support: the worker precaches the built app. A new version takes over
// after every open tab of the site is closed, so a session never mixes versions.
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {});
  });
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

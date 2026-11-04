import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App/App";
import "./ui/styles.css";
import { applyAppearance } from "./ui/appearance";
import { registerWorker } from "./updates";
import { focusClickedControls } from "./focusClicks";
applyAppearance();
focusClickedControls();
// Offline support: the worker precaches the built app. A newer version waits
// until the person reloads from the notice in the app (or closes every tab), so
// a session never mixes versions.
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () =>
    registerWorker(`${import.meta.env.BASE_URL}sw.js`),
  );
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

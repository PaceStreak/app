import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installErrorReporting } from "./lib/errors";
import { applyDisplay, applyTheme } from "./lib/prefs";
import { registerServiceWorker } from "./lib/pwa";
import "./styles.css";

installErrorReporting();
applyTheme();
applyDisplay();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
registerServiceWorker();

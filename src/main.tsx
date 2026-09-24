import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme } from "./lib/prefs";
import { registerServiceWorker } from "./lib/pwa";
import "./styles.css";

applyTheme();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
registerServiceWorker();

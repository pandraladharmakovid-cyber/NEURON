import React from "react";
import { Providers } from "./app/providers";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/phase2.css";
import "./styles/phase5.css";
import { registerOffline } from "./pwa/register";
void registerOffline();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Providers>
        <App />
      </Providers>
    </ErrorBoundary>
  </React.StrictMode>,
);

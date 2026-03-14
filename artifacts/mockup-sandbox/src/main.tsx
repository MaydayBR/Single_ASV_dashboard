// ============================================================================
// MAIN ENTRY POINT - React Application Bootstrap
// ============================================================================
// This is the single entry point for the entire React application.
// Flow: index.html loads this module -> mounts React at #root -> renders App
// The App component handles routing to either Gallery or PreviewRenderer.
// ============================================================================

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("[main.tsx] Starting React application bootstrap");
console.log("[main.tsx] Environment:", {
  mode: import.meta.env.MODE,
  baseUrl: import.meta.env.BASE_URL,
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
});

const rootElement = document.getElementById("root");
console.log("[main.tsx] Root DOM element found:", rootElement !== null);

if (!rootElement) {
  throw new Error("Failed to find #root element in DOM");
}

console.log("[main.tsx] Creating React root and rendering App component");
createRoot(rootElement).render(<App />);
console.log("[main.tsx] React root created and initial render triggered");

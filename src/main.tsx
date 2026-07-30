import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startAutoSync } from "./lib/offline";
import { registerServiceWorker } from "./lib/pwa";

startAutoSync();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);

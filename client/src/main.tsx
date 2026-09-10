import "./demo/fetchShim"; // no-op unless built with VITE_DEMO=1 (localhost design review)
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

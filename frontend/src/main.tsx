import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/globals.css";

// Apply stored theme before first render to avoid flash
const storedTheme = localStorage.getItem("theme");
document.documentElement.setAttribute("data-theme", storedTheme === "light" ? "light" : "dark");

const rootElement = document.querySelector("#root");

if (!rootElement) {
  throw new Error("找不到 React 掛載節點。");
}

createRoot(rootElement).render(<App />);

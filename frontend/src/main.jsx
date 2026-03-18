import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/tokens.css";
import "./styles/globals.css";

const rootElement = document.querySelector("#root");

if (!rootElement) {
  throw new Error("找不到 React 掛載節點。");
}

createRoot(rootElement).render(<App />);

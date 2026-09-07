import React from "react";
import { createRoot } from "react-dom/client";
import { readPlan } from "./storage";
import { openMap } from "./maps";
import App from "./App";
import "./style.css";
import "./companion.css";
import "./brand.css";
import { startOffline } from "./offline";
void startOffline();
let plan,
  warning = "";
try {
  plan = await readPlan();
} catch {
  warning =
    "Could not restore local storage. Import a saved plan to recover your work.";
}
try {
  plan ??= await openMap("bakurani");
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App initial={plan} warning={warning} />
    </React.StrictMode>,
  );
} catch {
  document.getElementById("root")!.textContent =
    "Could not load the map. Restart the local server and reload this page.";
}

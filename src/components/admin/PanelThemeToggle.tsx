import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Choice = "system" | "light" | "dark";
const KEY = "hq360-panel-theme";

/** Sets <html data-panel-theme> for the Admin/Expert panels. Runs inline before paint too. */
export const PANEL_THEME_SCRIPT = `try{var c=localStorage.getItem("${KEY}")||"system";var d=c==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):c;document.documentElement.setAttribute("data-panel-theme",d)}catch(e){}`;

function apply(choice: Choice) {
  const theme =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : choice;
  document.documentElement.setAttribute("data-panel-theme", theme);
}

const NEXT: Record<Choice, Choice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Choice, string> = {
  system: "Theme: matches your computer",
  light: "Theme: light",
  dark: "Theme: dark",
};

export function PanelThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    let saved: Choice = "system";
    try {
      saved = (localStorage.getItem(KEY) as Choice) || "system";
    } catch {
      // Storage blocked (private mode): fall back to the system theme.
    }
    setChoice(saved);
    apply(saved);
  }, []);

  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => apply("system");
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [choice]);

  function cycle() {
    const next = NEXT[choice];
    setChoice(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
  }

  const Icon = choice === "system" ? Monitor : choice === "light" ? Sun : Moon;
  return (
    <button
      type="button"
      className="panel-theme-toggle"
      onClick={cycle}
      aria-label={`${LABEL[choice]}. Click to change.`}
      title={`${LABEL[choice]} — click to change`}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

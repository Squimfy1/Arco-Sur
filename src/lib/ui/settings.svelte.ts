/**
 * The Settings screen's choices: the look (dark, light or the computer's own)
 * and the text size. Looks, not data, so they live in the frontend and are
 * kept on this computer only; the server never knows. theme.css reads the
 * root element's data-theme and data-text. static/look.js applies the saved
 * choices before the first paint.
 */

export type Theme = "dark" | "light" | "system";
export type TextSize = "standard" | "large";

const THEME_KEY = "arco-sur.theme";
const TEXT_KEY = "arco-sur.text";

function saved(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not kept for next time; still applied now.
  }
}

const storedTheme = saved(THEME_KEY);
export const settings = $state({
  theme: (storedTheme === "light" || storedTheme === "system" ? storedTheme : "dark") as Theme,
  text: (saved(TEXT_KEY) === "large" ? "large" : "standard") as TextSize,
});

const systemIsLight = () => matchMedia("(prefers-color-scheme: light)").matches;

function apply(): void {
  const root = document.documentElement;
  const light = settings.theme === "light" || (settings.theme === "system" && systemIsLight());
  root.setAttribute("data-theme", light ? "light" : "dark");
  if (settings.text === "large") root.setAttribute("data-text", "large");
  else root.removeAttribute("data-text");
}

export function setTheme(theme: Theme): void {
  settings.theme = theme;
  save(THEME_KEY, theme);
  apply();
}

export function setTextSize(text: TextSize): void {
  settings.text = text;
  save(TEXT_KEY, text);
  apply();
}

/** Re-apply when the computer switches between light and dark. An $effect. */
export function followSystem(): () => void {
  const query = matchMedia("(prefers-color-scheme: light)");
  const change = () => {
    if (settings.theme === "system") apply();
  };
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

"use client";

import { useSyncExternalStore, type ReactNode } from "react";

type Theme = "dark" | "light";
const key = "aven:admin-theme";
const eventName = "aven:admin-theme-change";
let cached: Theme | undefined;
function snapshot(): Theme {
  if (cached) return cached;
  try { return localStorage.getItem(key) === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}
function subscribe(update: () => void) {
  function storage(event: StorageEvent) { if (event.key === key || event.key === null) { cached = undefined; update(); } }
  window.addEventListener("storage", storage);
  window.addEventListener(eventName, update);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener(eventName, update); };
}
const serverSnapshot = (): Theme => "dark";
function useTheme() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }

export default function AdminTheme({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <div className="av-admin-theme" data-theme={theme}>{children}</div>;
}

export function AdminThemeToggle() {
  const theme = useTheme();
  return <button type="button" className="av-admin-theme-toggle" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => {
    cached = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(key, cached); } catch { /* Preference works for this session even when storage is blocked. */ }
    window.dispatchEvent(new Event(eventName));
  }}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{theme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z" />}</svg>{theme === "dark" ? "Light mode" : "Dark mode"}</button>;
}

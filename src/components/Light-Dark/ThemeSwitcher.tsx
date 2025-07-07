import React, { useEffect, useState } from "react";
import "./ThemeSwitcher.scss";

const THEME_KEY = "theme-preference";

function getSystemTheme(): "light" | "dark" {
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function getInitialTheme(): "light" | "dark" {
  // 1. User preference
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // 2. System/browser
  return getSystemTheme();
}

const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme());

  // Apply theme to <html> and store preference
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Respond to system theme changes
  useEffect(() => {
    const listener = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  return (
    <button
      className="theme-switcher"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      onClick={toggleTheme}
      type="button"
    >
      <span className="slider">
        <span className="icon sun">
          <i className="bx bxs-sun" />
        </span>
        <span className="icon moon">
          <i className="bx bxs-moon" />
        </span>
        <span className={`thumb ${theme}`} />
      </span>
    </button>
  );
};

export default ThemeSwitcher;

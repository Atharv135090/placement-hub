import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(() => {
    // Clear stale localStorage theme so fresh documents always initialize to Light Mode
    try {
      localStorage.removeItem("placement_hub_theme");
    } catch {
      // ignore storage errors
    }
    // Per PRD §7, §9, §37: A fresh website document/tab always opens in Light Mode by default.
    // Within an active tab, user manual choice is preserved in sessionStorage.
    return sessionStorage.getItem("placement_hub_theme") || "light";
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("placement_hub_theme", themeMode);
    } catch {
      // ignore
    }

    function applyTheme() {
      let resolvedTheme = themeMode;
      if (themeMode === "system") {
        resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      document.documentElement.setAttribute("data-theme", resolvedTheme);
    }

    applyTheme();

    if (themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [themeMode]);

  function setThemeMode(mode) {
    setThemeModeState(mode);
  }

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(() => {
    return localStorage.getItem("placement_hub_theme") || "dark";
  });

  useEffect(() => {
    localStorage.setItem("placement_hub_theme", themeMode);

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

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") ?? "system"
  );

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = (dark) => {
      root.classList.toggle("dark", dark);
      // Keep native controls (e.g. select dropdown panel) aligned with app theme.
      root.style.colorScheme = dark ? "dark" : "light";
    };

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mq.matches);
      const handler = (e) => applyDark(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      applyDark(theme === "dark");
    }
  }, [theme]);

  const setAndPersist = (value) => {
    localStorage.setItem("theme", value);
    setTheme(value);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setAndPersist }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

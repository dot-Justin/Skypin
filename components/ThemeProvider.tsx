"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize from the HTML element's class (set by blocking script)
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "dark"; // fallback for SSR
  });
  const [mounted, setMounted] = useState(false);

  // Mark as mounted and sync with cookie if needed
  useEffect(() => {
    const savedTheme = Cookies.get("skypin-theme") as Theme | undefined;

    // If no cookie exists, set default to dark
    if (!savedTheme) {
      Cookies.set("skypin-theme", "dark", { expires: 365 });
    }

    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    Cookies.set("skypin-theme", newTheme, { expires: 365 });

    // Apply theme class to document
    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";

export type Theme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "crewconnect-theme";
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export const DEFAULT_THEME_CONTEXT: ThemeContextValue = {
  theme: "light",
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(DEFAULT_THEME_CONTEXT);

function getSystemTheme(): Theme {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light";
  }
  return "light";
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // localStorage may be inaccessible (private browsing or disabled)
  }

  return getSystemTheme();
}

function applyThemeToDocument(theme: Theme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
    root.style.colorScheme = "light";
  }

  const metaThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", theme === "dark" ? "#0B0F14" : "#115E59");
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const transitionTimerRef = useRef<number | null>(null);

  const setTheme = useCallback((nextTheme: Theme) => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.add("theme-transition");
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      transitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove("theme-transition");
        transitionTimerRef.current = null;
      }, 320);
    }

    setThemeState(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // storage unavailable
    }
    applyThemeToDocument(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Clean up transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  // Synchronize on mount and handle system preference changes if no manual preference stored
  useEffect(() => {
    applyThemeToDocument(theme);

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY);

    const handleSystemChange = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        // If the user has not explicitly set a preference, follow the OS
        if (!stored) {
          const sysTheme: Theme = e.matches ? "dark" : "light";
          setThemeState(sysTheme);
          applyThemeToDocument(sysTheme);
        }
      } catch {
        // storage error
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemChange);
      return () => mediaQuery.removeEventListener("change", handleSystemChange);
    } else if (
      typeof (mediaQuery as { addListener?: (fn: (e: MediaQueryListEvent) => void) => void })
        .addListener === "function"
    ) {
      (mediaQuery as { addListener: (fn: (e: MediaQueryListEvent) => void) => void }).addListener(
        handleSystemChange
      );
      return () =>
        (
          mediaQuery as { removeListener: (fn: (e: MediaQueryListEvent) => void) => void }
        ).removeListener(handleSystemChange);
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  return useContext(ThemeContext);
};

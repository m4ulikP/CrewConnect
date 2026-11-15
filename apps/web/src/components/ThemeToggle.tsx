import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { isDark, toggleTheme } = useTheme();

  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      data-testid="theme-toggle"
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-md border border-border-strong bg-surface hover:bg-surface-hover text-ink-primary transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer group flex-shrink-0 ${className}`}
    >
      <span className="sr-only">{label}</span>
      {isDark ? (
        <Sun
          className="w-4 h-4 text-highlight transition-transform duration-200 group-hover:rotate-45"
          aria-hidden="true"
        />
      ) : (
        <Moon
          className="w-4 h-4 text-ink-primary transition-transform duration-200 group-hover:-rotate-12"
          aria-hidden="true"
        />
      )}
    </button>
  );
};

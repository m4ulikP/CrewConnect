/** @type {import('tailwindcss').Config} */
function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${variableName}) calc(${opacityValue} * 100%), transparent)`;
    }
    return `var(${variableName})`;
  };
}

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: withOpacity("--ground"),
        chrome: withOpacity("--chrome"),
        surface: {
          DEFAULT: withOpacity("--surface"),
          tonal: withOpacity("--surface-tonal"),
          hover: withOpacity("--surface-hover"),
        },
        border: {
          subtle: withOpacity("--border-subtle"),
          strong: withOpacity("--border-strong"),
          control: withOpacity("--border-control"),
          focus: withOpacity("--border-focus"),
        },
        ink: {
          primary: withOpacity("--ink-primary"),
          secondary: withOpacity("--ink-secondary"),
          muted: withOpacity("--ink-muted"),
          onAccent: withOpacity("--ink-on-accent"),
        },
        accent: {
          DEFAULT: withOpacity("--accent"),
          hover: withOpacity("--accent-hover"),
          tint: withOpacity("--accent-tint"),
        },
        highlight: {
          DEFAULT: withOpacity("--highlight"),
          hover: withOpacity("--highlight-hover"),
          soft: withOpacity("--highlight-soft"),
        },
        tangelo: {
          DEFAULT: withOpacity("--tangelo"),
          soft: withOpacity("--tangelo-soft"),
        },
        positive: {
          DEFAULT: withOpacity("--positive"),
          bg: withOpacity("--positive-bg"),
        },
        warning: {
          DEFAULT: withOpacity("--warning"),
          bg: withOpacity("--warning-bg"),
        },
        danger: {
          DEFAULT: withOpacity("--danger"),
          solid: withOpacity("--danger-solid"),
          bg: withOpacity("--danger-bg"),
        },
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "IBM Plex Sans", "sans-serif"],
        serif: ["Newsreader", "serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Sans", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
        sheet: "14px",
      },
      transitionTimingFunction: {
        "editorial-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "editorial-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      transitionDuration: {
        press: "100ms",
        fast: "180ms",
        panel: "220ms",
        reveal: "600ms",
      },
    },
  },
  plugins: [],
};

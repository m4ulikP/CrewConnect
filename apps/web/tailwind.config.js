/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#F6F6F4",
        chrome: "#EEEDE9",
        surface: {
          DEFAULT: "#FFFFFF",
          tonal: "#F1F0EC",
          hover: "#FAF9F7",
        },
        border: {
          subtle: "#E4E2DC",
          strong: "#CFCBC2",
          control: "#8B8982",
          focus: "#115E59",
        },
        ink: {
          primary: "#18181B",
          secondary: "#52525B",
          muted: "#64635E",
          onAccent: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#115E59",
          hover: "#0F4C48",
          tint: "#E6F2F0",
        },
        highlight: {
          DEFAULT: "#FDE047",
          hover: "#FACC15",
          soft: "#FEF9C3",
        },
        tangelo: {
          DEFAULT: "#FF5A1F",
          soft: "#FFEDD5",
        },
        positive: {
          DEFAULT: "#166534",
          bg: "#DCFCE7",
        },
        warning: {
          DEFAULT: "#92400E",
          bg: "#FEF3C7",
        },
        danger: {
          DEFAULT: "#991B1B",
          solid: "#B91C1C",
          bg: "#FEE2E2",
        },
      },
      fontFamily: {
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

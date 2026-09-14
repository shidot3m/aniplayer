/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#090A0F",
        card: "#12131A",
        "card-hover": "#1A1C26",
        primary: {
          DEFAULT: "#E11D48",
          hover: "#BE123C",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#1E1B4B",
          foreground: "#F8FAFC",
        },
        accent: {
          DEFAULT: "#6366F1",
          hover: "#4F46E5",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#1E202E",
          foreground: "#94A3B8",
        },
        border: "rgba(255, 255, 255, 0.08)",
      },
      borderRadius: {
        lg: "var(--radius, 0.75rem)",
        md: "calc(var(--radius, 0.75rem) - 2px)",
        sm: "calc(var(--radius, 0.75rem) - 4px)",
      },
    },
  },
  plugins: [],
};

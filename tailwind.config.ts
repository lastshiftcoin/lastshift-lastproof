import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          card: "var(--bg-card)",
          "card-hover": "var(--bg-card-hover)",
          input: "var(--bg-input)",
        },
        border: {
          DEFAULT: "var(--border)",
          2: "var(--border-2)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          dim: "var(--text-dim)",
        },
        brand: {
          orange: "var(--orange)",
          green: "var(--green)",
          gold: "var(--gold)",
          purple: "var(--purple)",
          silver: "var(--silver)",
          bronze: "var(--bronze)",
          red: "var(--red)",
          blue: "var(--blue)",
        },
      },
      fontFamily: {
        sans: ["var(--sans)"],
        mono: ["var(--mono)"],
      },
      borderRadius: {
        sm: "var(--r-sm)",
        btn: "var(--r-btn)",
        card: "var(--r-card)",
        pill: "var(--r-pill)",
      },
    },
  },
  plugins: [],
};

export default config;

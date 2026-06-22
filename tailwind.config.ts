import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "turquoise-blue": {
          50: "#eefcfd",
          100: "#d3f7fa",
          200: "#aceef5",
          300: "#62dceb",
          400: "#33c8dd",
          500: "#17abc3",
          600: "#1689a4",
          700: "#196e85",
          800: "#1d5a6d",
          900: "#1c4c5d",
          950: "#0d313f"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgb(13 49 63 / 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light Theme (base colors - when NOT in dark mode)
        background: "#f5fcfd",
        surface: "#d8f0f2",
        accent: {
          primary: "#0096b5",
          secondary: "#58c0d6",
        },
        text: {
          primary: "#052628",
          secondary: "#3b5b5e",
        },
        warm: "#e3a45b",

        // Dark Theme (applied with 'dark' class)
        dark: {
          background: "#050e13ff",
          surface: "#0e2330ff",
          accent: {
            primary: "#005b85ff",
            secondary: "#113e53ff",
          },
          text: {
            primary: "#e2fcfc",
            secondary: "#a7c7c7",
          },
          warm: "#f0a85d",
        },
      },
      fontFamily: {
        serif: ["var(--font-gambarino)", "serif"],
        sans: ["var(--font-articulat)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

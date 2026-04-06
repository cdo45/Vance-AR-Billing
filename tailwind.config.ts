import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy:    "#1F3864",
        teal:    "#1F6B6B",
        red:     "#C8102E",
        dkgreen: "#1E6B1E",
        ltgray:  "#F2F2F2",
      },
    },
  },
  plugins: [],
};
export default config;

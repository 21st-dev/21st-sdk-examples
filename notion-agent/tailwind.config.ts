import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./node_modules/@21st-sdk/react/dist/**/*.{js,mjs}"],
  theme: { extend: {} },
  plugins: [],
}

export default config

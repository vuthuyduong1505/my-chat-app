/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#003B44",
        secondary: "#00BFA5",
        accent: "#F0F7F7",
        // Trắng nội dung chính — dùng utility `bg-light` / `text-light`
        light: "#FFFFFF"
      },
      boxShadow: {
        soft: "0 4px 24px -4px rgba(0, 59, 68, 0.08), 0 8px 16px -8px rgba(0, 59, 68, 0.06)"
      }
    }
  },
  plugins: []
};

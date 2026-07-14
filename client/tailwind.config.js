/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // "Enigma" palette
        paper: "#e9e8e4",   // warm light-gray page background
        card: "#ffffff",    // floating surfaces
        cream: "#fdfdfb",
        butter: "#edefb8",  // pale-yellow accent
        butterSoft: "#f6f5da",
        ink: "#1a1a1a",     // near-black text / pills
      },
      fontFamily: {
        display: ["Poppins", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "28px",
      },
      boxShadow: {
        float: "0 20px 60px -25px rgba(0,0,0,0.18)",
        soft: "0 8px 30px -18px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};

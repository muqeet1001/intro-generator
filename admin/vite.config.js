import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works both at /admin (served by the API)
  // and at the root of a separate static host (Netlify/Vercel/S3).
  base: "./",
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});

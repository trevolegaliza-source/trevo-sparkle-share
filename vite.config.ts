import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // INFRA-001: nunca expor sourcemap em prod (vaza estrutura interna do código)
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        // PERF-005: isola libs pesadas em chunks separados pra cache long-term
        // e evita re-download em deploys que não tocam essas libs.
        manualChunks: {
          'pdf-vendor': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          'd3-vendor': ['d3'],
        },
      },
    },
  },
}));

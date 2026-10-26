
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Inyectamos process.env para que el SDK de Google GenAI funcione correctamente
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.VITE_API_KEY || ''),
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        external: ['@google/genai'], 
        output: {
          globals: {
            '@google/genai': 'GoogleGenAI'
          }
        }
      }
    },
    server: {
      port: 5173,
    },
  };
});

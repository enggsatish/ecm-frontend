import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import Terminal from "vite-plugin-terminal";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),   // ← Tailwind v4 plugin
    ...(mode === 'development' ? [Terminal({
      console: 'terminal',
      output: ['terminal', 'console'],
      theme: {
        background: '#1e1e1e',
        text: '#d4d4d4',
        promptSymbol: '>',
        fontSize: '14px',
        fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
      },
      history: true,
    })] : []),
  ],
  server: {
  port: 3000,
  proxy: {
      // ALL api calls go through the gateway on 8080.
      // The gateway routes internally to identity (8081) or document (8082).
      // No path rewrite needed — gateway preserves /api/** paths.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    }
  }
  // server: {
  //   port: 3000,      // use 3000 instead of 5173
  //   proxy: {
  //     // Proxy API calls to Spring Boot
  //     // avoids CORS issues in development
  //     '/api': {
  //       target: 'http://localhost:8081',
  //       changeOrigin: true,
  //       secure: false,
  //       rewrite: (path) => path.replace(/^\/api/, '' ),
  //     },
  //     // Proxy document API calls to ecm-document service
  //     '/docs-api': {
  //       target: 'http://localhost:8082',
  //       changeOrigin: true,
  //       secure: false,
  //       rewrite: (path) => path.replace(/^\/docs-api/, ''),
  //     }
  //   }
  // }
}))
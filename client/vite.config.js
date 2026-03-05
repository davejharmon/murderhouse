// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Dev-only plugin: exposes POST /dev/write-file for String Sheets "Apply to Source"
function devWriteFilePlugin() {
  return {
    name: 'dev-write-file',
    configureServer(server) {
      server.middlewares.use('/dev/write-file', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { file, content } = JSON.parse(body);
            // Only allow writes within src/
            const target = path.resolve(__dirname, 'src', file);
            if (!target.startsWith(path.resolve(__dirname, 'src'))) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Path outside src/ not allowed' }));
              return;
            }
            fs.writeFileSync(target, content, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devWriteFilePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
  },
});

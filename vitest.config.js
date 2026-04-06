// vitest.config.js
// Unified test config: server (node) + client (jsdom + React)
// Run all tests: npm test
// Run server only: vitest run --project server
// Run client only: vitest run --project client

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          include: ['server/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'client/src'),
            '@shared': path.resolve(__dirname, 'shared'),
          },
        },
        test: {
          name: 'client',
          include: ['client/src/**/*.test.{js,jsx}'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./client/src/test/setup.js'],
        },
      },
    ],
  },
})

// server/firmware.js
// HTTP request handler for ESP32 OTA firmware updates.
// Serves version manifest and firmware binary from server/firmware/.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIRMWARE_DIR = path.join(__dirname, 'firmware')
const VERSION_FILE = path.join(FIRMWARE_DIR, 'version.json')
const BINARY_FILE = path.join(FIRMWARE_DIR, 'firmware.bin')

function getVersion() {
  try {
    const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'))
    return data.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Handle HTTP requests for firmware endpoints.
 * GET /firmware/version  → { version: "1.0.2" }
 * GET /firmware/firmware.bin → binary stream
 */
export function handleFirmwareRequest(req, res) {
  if (req.url === '/firmware/version') {
    const version = getVersion()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ version }))
    return true
  }

  if (req.url === '/firmware/firmware.bin') {
    if (!fs.existsSync(BINARY_FILE)) {
      res.writeHead(404)
      res.end('No firmware available')
      return true
    }
    // Read entire file into memory — avoids chunked encoding issues with ESP32 OTA
    const data = fs.readFileSync(BINARY_FILE)
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length,
    })
    res.end(data)
    console.log(`[Firmware] Serving firmware.bin (${(data.length / 1024).toFixed(0)} KB)`)
    return true
  }

  return false  // Not a firmware request
}

/**
 * Express middleware version for web.js (production mode).
 */
export function firmwareRoutes(app) {
  app.get('/firmware/version', (req, res) => {
    res.json({ version: getVersion() })
  })

  app.get('/firmware/firmware.bin', (req, res) => {
    if (!fs.existsSync(BINARY_FILE)) {
      return res.status(404).send('No firmware available')
    }
    res.sendFile(BINARY_FILE)
    const stat = fs.statSync(BINARY_FILE)
    console.log(`[Firmware] Serving firmware.bin (${(stat.size / 1024).toFixed(0)} KB)`)
  })
}

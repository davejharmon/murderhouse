# Web Deployment (Playtest Mode)

Deploy Murderhouse to a public URL so players can join from their phones while the host shares the `/screen` view over Zoom.

This is separate from the local ESP32 development mode (`npm run dev`), which remains unchanged.

## How It Works

`server/web.js` serves the built React client and WebSocket on a single port — no separate Vite dev server, no UDP discovery. PaaS platforms detect the Node.js project and run `npm install` → `npm run build` → `npm start`.

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.com](https://railway.com) and create a new project
3. Select **Deploy from GitHub repo** and pick this repository
4. Railway auto-detects Node.js. Verify these settings under **Settings > Build**:
   - **Build command**: `npm run build`
   - **Start command**: `npm start`
5. Click **Deploy** — Railway assigns a public URL (e.g. `https://murderhouse-production.up.railway.app`)

No environment variables are required. Railway provides `PORT` automatically.

## Deploy to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) and create a **New Web Service**
3. Connect your GitHub repo
4. Set:
   - **Build command**: `npm install && npm run build`
   - **Start command**: `npm start`
5. Click **Create Web Service** — Render assigns a public URL

No environment variables are required. Render provides `PORT` automatically.

## Starting a Web Game

1. **Host** opens `https://<your-url>/host` on their computer
2. **Host** opens `https://<your-url>/screen` in another tab and shares it over Zoom (or casts to a TV)
3. **Players** visit `https://<your-url>/player/1` through `/player/9` on their phones
   - Share the URL in chat, or tell players the base URL and their number
4. Host starts the game from the host dashboard — same flow as local play

### Tips

- Players only need a phone browser — no app install
- The host dashboard and screen view work best on a laptop/desktop
- If a player disconnects, they can revisit their `/player/N` URL to reconnect
- For the best experience, host should hide the browser chrome when screen-sharing the `/screen` view (F11 for fullscreen)

## Local Testing (Web Mode)

To test the web deployment locally before pushing:

```bash
npm run build
npm run web
```

Then visit `http://localhost:8080/host`, `http://localhost:8080/screen`, and `http://localhost:8080/player/1`.

## Local Development (Unchanged)

```bash
npm run dev
```

This still runs the Vite dev server on port 5173 and the WebSocket server on port 8080 with UDP discovery for ESP32 terminals — nothing has changed.

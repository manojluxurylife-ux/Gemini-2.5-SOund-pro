# Nexus Justice — Offline Qwen 2.5 · 0.5B

A fully offline legal-assistance platform for Kerala advocates.  
**No API key required. No internet needed after first load.**

## Architecture

```
Browser (React + Transformers.js)
  └── Qwen 2.5 · 0.5B ONNX  ← cached in IndexedDB after first download
  └── Web Speech API  ← STT + TTS built into the browser / Android

Node Server (server.ts)
  ├── /api/qwen          ← proxies text to Python Qwen server (optional)
  ├── /api/qwen/stream   ← SSE token stream (optional)
  └── /auth/*            ← Google OAuth (optional, for Gemini fallback)

Python Server (qwen_server.py)  ← optional, for server-side inference
  └── Qwen/Qwen2.5-0.5B-Instruct via HuggingFace transformers
```

## Quick Start

### 1. Install dependencies
```bash
npm install
# postinstall automatically copies sql-wasm.wasm to public/
```

### 2. Start the Node server
```bash
npm run server        # runs server.ts with tsx
# or in dev mode:
npm run dev           # Vite dev server (port 3000)
```

### 3. (Optional) Start the Python Qwen server
Only needed if you want server-side inference instead of in-browser.
```bash
pip install fastapi uvicorn transformers torch accelerate
uvicorn qwen_server:app --port 8000
```

### 4. Download the brain
Open `http://localhost:3000` → Command Center → **Download Brain**  
~560 MB · downloads once · stays in browser IndexedDB

## Environment Variables

Copy `.env.example` to `.env`:
```
QWEN_URL=http://127.0.0.1:8000/generate   # Python server (optional)
SESSION_SECRET=your-secret-here

# Optional — only needed for Gemini fallback or Google Drive sync
GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_URL=https://your-domain.com
```

## Key Features

- **100% offline AI** — Qwen 2.5 · 0.5B ONNX runs in-browser via WebGPU/WASM
- **Streaming output** — tokens appear word-by-word in chat
- **Voice AI** — always-on STT/TTS using Web Speech API
- **TTS interrupt** — speaking stops instantly when user starts talking
- **Local DB** — SQLite via sql.js, persisted in IndexedDB (no 5 MB limit)
- **OCR** — Tesseract.js for document scanning
- **Legal drafting** — petitions, plaints, suggestions, case research
- **Client management** — full client + case database

## Browser Requirements

- Chrome 113+ or Edge 113+ (WebGPU, best performance)
- Firefox / Safari — falls back to WASM (slower first inference)
- Android Chrome — full STT/TTS support via ML Kit voices

## Notes

- First model load downloads ~560 MB via Transformers.js (cached forever after)
- `CROSS-ORIGIN-ISOLATION` headers are set automatically — required for SharedArrayBuffer
- The `BrainPanel` pre-warms the pipeline so first inference is instant

<<<<<<< HEAD
## Codelens.ai  Web App
=======
## CodeLens AI 2.0
>>>>>>> 7188123 (good to go but still need to modefy the ai response)

CodeLens is a local-only, open-source AI-powered developer tool. It supports real-time, token-by-token streaming responses using **Ollama + Llama 3.1 (8B)** running locally on your machine. No paid API keys required.

### Features
- **AI-powered** code debugging, roadmap generation, code writing, and practice arena
- **Real-time streaming** — token-by-token output for all AI modules
- **Local execution** — run Python, C, and C++ code directly in the browser terminal
- **Interactive terminal** with WebSocket-based I/O
- **Flowchart & algorithm visualization** with step-by-step video generation
- **History panel** (local storage)
- 5 models: Code Runner, Smart Debugger, Project Roadmap, Practice Arena, Code Writer

### Prerequisites
- **Node.js 18+**
- **Python 3.x** (for Python code execution)
- **GCC / G++** installed and available in PATH (for C/C++ execution)
- **Ollama** installed and running — [Download Ollama](https://ollama.com)
- **Llama 3.1 8B model** pulled in Ollama

### Setup

#### 1. Install & Start Ollama
Download and install Ollama from [ollama.com](https://ollama.com), then pull the model:
```bash
ollama pull llama3.1:8b
```
Make sure Ollama is running (it starts automatically after install).

#### 2. Install Project Dependencies
```bash
cd frontend
npm install

cd ../backend
npm install
```

#### 3. Run (two terminals)

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

### AI Provider Configuration

By default, the app uses **Ollama (local)** with the `llama3.1:8b` model. No API keys needed.

#### Default: Ollama (Local, Free, Offline)
- Install [Ollama](https://ollama.com) and pull a model:
  ```bash
  ollama pull llama3.1:8b
  ```
- The backend auto-detects available Ollama models
- Configure in `backend/.env`:
  ```env
  AI_PROVIDER=ollama
  OLLAMA_BASE_URL=http://localhost:11434
  OLLAMA_MODEL=llama3.1:8b
  ```

#### Alternative: Google Gemini (Cloud)
- Set `GEMINI_API_KEY` in `backend/.env`
- Set `AI_PROVIDER=gemini`
- Optional: `GEMINI_MODEL=gemini-1.5-flash`

### How Streaming Works
All AI modules stream responses token-by-token in real time:
1. Frontend sends a request to `/api/ai/stream`
2. Backend opens a connection to Ollama's `/api/generate` endpoint with `stream: true`
3. Each token is forwarded to the frontend via Server-Sent Events (SSE)
4. The UI renders each token as it arrives — no waiting for the full response

### Notes
- The backend runs on `http://localhost:8000`
- Flowcharts and execution playback are rendered locally in the UI
- For GCC/G++ setup on Windows, install MinGW or MSYS2 and ensure `gcc` and `g++` are in PATH
- All AI processing happens locally via Ollama — your code never leaves your machine

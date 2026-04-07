## Codelens.ai  Web App

Codelens is a local-only, open-source hackathon web app that looks like a Claude-style AI assistant. It supports four models and runs Python/C/C++ code locally without Docker or Kubernetes.

### Features
- Claude-like UI with light purple glassmorphism
- History panel (local storage)
- 4 models: Code Runner, Debugger, Idea Builder, Learner
- Local backend to run Python/C/C++ with timeouts

### Prerequisites
- Node.js 18+
- Python 3.x (for Python model)
- GCC / G++ installed and available in PATH (for C/C++)

### Setup
```bash
cd "C:\Users\Sachin.K\github repo\codelens-ai2.0"

cd frontend
npm install

cd ../backend
npm install
```

### Run (two terminals)
```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

### Notes
- The backend runs on `http://localhost:8000`.
- Flowcharts and execution playback are rendered locally in the UI.
- For GCC/G++ setup, install MinGW or MSYS2 and ensure `gcc` and `g++` are in PATH.

### AI provider (no Ollama required)
By default, the app can use **Google Gemini** (hosted) if you set an API key, so your friends can run it from GitHub without installing Ollama.

- **Option A (recommended)**: Google Gemini (hosted)
  - Set `GEMINI_API_KEY` in the backend environment.
  - Optional: `GEMINI_MODEL` (default: `gemini-1.5-flash`)
  - Optional: `AI_PROVIDER=gemini`

- **Option B**: Local Ollama (offline)
  - Install Ollama and pull a model (example: `ollama pull qwen2.5-coder:7b`)
  - Optional: `OLLAMA_MODEL`, `OLLAMA_BASE_URL`
  - Optional: `AI_PROVIDER=ollama`

If `AI_PROVIDER=auto` (default), the backend will **prefer Gemini when `GEMINI_API_KEY` is set**, otherwise it will fall back to Ollama.

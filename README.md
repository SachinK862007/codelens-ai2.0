## Codelens Hackathon Web App

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
- The backend runs on `http://localhost:5050`.
- Flowcharts and execution playback are rendered locally in the UI.
- For GCC/G++ setup, install MinGW or MSYS2 and ensure `gcc` and `g++` are in PATH.

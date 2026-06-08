## Codelens.ai Web App

CodeLens is a local-first, open-source AI-powered developer tool. It supports real-time token-by-token streaming using **Ollama (local)** or **Google Gemini (cloud)**. No paid API keys required for local use.

---

### Features

- **Code Runner** — write and run Python, C, or C++ in a Monaco editor with an interactive WebSocket terminal. Includes an Algorithm & Flowchart popup powered by the backend.
- **Smart Error Debugger** — paste broken code or a terminal stack trace. AI returns a structured error report (every error listed separately), full corrected code, and a live terminal to run the fix interactively. **Now powered by Wikipedia API** for fast, real-world context on programming errors.
- **Project Roadmap Generator** — describe a project idea and get a tailored roadmap with tech stack, APIs, research references, file/folder structure, build phases, and deployment steps.
- **Practice Arena** — VS Code-style Monaco editor with graded coding challenges. Logic-based grading (case-insensitive), fast local pre-check before hitting the AI.
- **Code Writer** — describe what you want in any of 13 languages. Returns structured output: generated code, algorithm steps (in a sleek **Modal Popup**), and an execution flowchart (dynamically rendered via **mermaid.js**). **Backed by Wikipedia API** to ensure accuracy and real-world relevance.
- **Interactive Terminal** — WebSocket-based, renders output correctly line-by-line using a `<pre>` element. Supports live stdin input mid-execution.
- **History Panel** — saved locally in browser storage.
- **AI Loading Animations** — phase-aware streaming progress indicators per module.
- **Model Switcher** — switch between the 5 modules from the top nav.

---

### Prerequisites

- **Node.js 18+**
- **Python 3.x** — for Python code execution (`python` or `python3` in PATH)
- **GCC / G++** — for C/C++ execution (MinGW or MSYS2 on Windows)
- **Ollama** — [Download](https://ollama.com) — for local AI (free, offline)
- A pulled Ollama model, e.g. `qwen2.5-coder:1.5b` or `llama3.1:8b`

---

### Setup

#### 1. Install & Start Ollama

```bash
ollama pull qwen2.5-coder:1.5b
```

Ollama starts automatically after install. Verify it's running at `http://localhost:11434`.

#### 2. Install Dependencies

```bash
cd frontend
npm install

cd ../backend
npm install
```

#### 3. Configure Environment

Copy `backend/.env.example` to `backend/.env` and set your values:

```env
# AI provider: ollama | gemini | auto
AI_PROVIDER=ollama

# Ollama settings (local, free)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:1.5b

# Gemini settings (optional cloud alternative)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

# Generation settings
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=1024
```

#### 4. Run (two terminals)

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

Open `http://localhost:5173`.

---

### AI Provider Options

| Provider | Cost | Requires | Notes |
|---|---|---|---|
| Ollama (default) | Free | Local install + model pull | Fully offline, code never leaves machine |
| Gemini | Free tier | `GEMINI_API_KEY` in `.env` | Cloud-based, faster on low-end hardware |
| auto | — | — | Uses Gemini if key present, else Ollama |

---

### How Streaming Works

1. Frontend sends `POST /api/ai/stream` with `{ system, userText }`
2. Backend streams SSE events: `phase`, `delta`, `done`, `error`
3. Phase events drive the loading animation (connecting → thinking → planning → writing → streaming)
4. Delta events append tokens to the collected buffer in real time
5. On `done`, the buffer is parsed — with multi-layer JSON repair for unescaped newlines, quotes, and backtick strings common in local model output

---

### JSON Repair Pipeline

Local models frequently output malformed JSON (literal newlines in strings, unescaped quotes, backtick fences). The parser applies these steps in order:

1. Repair literal `\n` / `\t` inside strings
2. Strip markdown code fences
3. Fix backtick and triple-quote string boundaries
4. Brace-count extraction with incomplete JSON closing
5. Field-by-field extraction fallback (`extractCodeWriterFields`) for Code Writer when the `code` field contains unescaped quotes

---

### Project Structure

```
codelens-ai2.0/
  backend/
    server.js          # Express + WebSocket server, Ollama/Gemini streaming, code execution
    .env               # AI provider config (copy from .env.example)
  frontend/
    src/
      models/
        ModelOne.jsx       # Code Runner
        ModelTwo.jsx       # Smart Error Debugger
        ModelThree.jsx     # Project Roadmap Generator
        ModelFour.jsx      # Practice Arena
        ModelCodeWriter.jsx # Code Writer
      components/
        SimpleTerminal.jsx     # WebSocket terminal (pre-based output rendering)
        DebuggerReport.jsx     # Structured error report + live terminal
        CodeWorkbench.jsx      # Monaco editor wrapper
        FlowchartDiagram.jsx   # SVG flowchart renderer
        AILoadingAnimation.jsx # Phase-aware streaming indicator
        AIResponseCard.jsx     # Fallback display for unparseable AI output
        MarkdownRenderer.jsx   # Markdown-to-JSX renderer
      lib/
        claudeStream.js    # SSE streaming client with retry + health check
        partialJson.js     # Multi-layer JSON repair and extraction
        debuggerParse.js   # Debugger-specific JSON normalization
        codeRun.js         # REST code execution client
      data/
        practiceQuestions.js  # Practice Arena question bank
  docs/
    ARCHITECTURE.md
    MODELS.md
```

---

### Notes

- Backend runs on `http://localhost:8000`, frontend on `http://localhost:5173`
- WebSocket terminal at `ws://localhost:8000` handles interactive stdin mid-run
- For C/C++ on Windows: install [MinGW](https://www.mingw-w64.org) or [MSYS2](https://www.msys2.org) and add `gcc`/`g++` to PATH
- The debugger skips auto-verification for programs that use `input()` / `scanf` / `cin` to avoid EOFErrors
- All Ollama processing is local — your code never leaves your machine

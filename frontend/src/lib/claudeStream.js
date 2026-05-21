/**
 * Stream AI responses from the backend SSE endpoint.
 * Supports phase callbacks, health preflight, connection timeout, and automatic retry.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const STREAM_URL = `${API_BASE}/api/ai/stream`;
const HEALTH_URL = `${API_BASE}/api/health`;
const TIMEOUT_MS = 90000; // 90s — cold Ollama models need time for first token

async function checkOllamaHealth() {
  try {
    const res = await fetch(HEALTH_URL, { method: "GET", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return data?.ollama?.reachable === true;
  } catch {
    return false;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.system   – System prompt
 * @param {string} opts.userText – User message
 * @param {function} opts.onDelta  – Called with each text token
 * @param {function} [opts.onPhase] – Phase changes (connecting/thinking/planning/writing/streaming)
 * @param {AbortSignal} [opts.signal] – Abort signal
 * @param {number} [opts.retries=2] – Retries on network failure
 */
export async function streamClaudeJson({ system, userText, onDelta, onPhase, signal, retries = 2 }) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    try {
      onPhase?.("connecting", "Connecting to local AI...");

      if (attempt === 0) {
        const healthy = await checkOllamaHealth();
        if (!healthy) {
          onPhase?.("connecting", "Waiting for Ollama — starting local model...");
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const mergedSignal = signal
        ? mergeAbortSignals(signal, controller.signal)
        : controller.signal;

      const res = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, userText }),
        signal: mergedSignal
      });

      clearTimeout(timeoutId);

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`AI stream failed (${res.status}). ${text}`.trim());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const sep = buffer.indexOf("\n\n");
          if (sep === -1) break;
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const line = raw.split("\n").find((l) => l.trim().startsWith("data:"));
          if (!line) continue;
          const payload = line.trim().slice(5).trim();
          if (!payload) continue;

          let evt;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }

          if (evt.type === "phase") {
            onPhase?.(evt.phase, evt.label);
          } else if (evt.type === "delta") {
            onDelta?.(evt.text || "");
          } else if (evt.type === "error") {
            throw new Error(evt.error || "AI stream error.");
          } else if (evt.type === "done") {
            return;
          }
        }
      }

      return;
    } catch (e) {
      lastError = e;

      if (e?.name === "AbortError" && signal?.aborted) {
        throw e;
      }

      const msg = e?.message || "";
      if (msg.includes("AI stream error") || msg.includes("AI stream failed")) {
        throw e;
      }

      if (attempt < retries) {
        const delay = (attempt + 1) * 2000;
        onPhase?.("retrying", `Reconnecting in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  const hint = lastError?.message?.includes("Ollama")
    ? lastError.message
    : "AI request failed after retries. Start Ollama (`ollama serve`) and ensure a model is installed (`ollama pull llama3.1:8b`).";

  throw new Error(hint);
}

function mergeAbortSignals(a, b) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

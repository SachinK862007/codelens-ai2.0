/**
 * Stream AI responses from the backend SSE endpoint.
 * Supports phase callbacks, connection timeout, and automatic retry.
 *
 * @param {object} opts
 * @param {string} opts.system   – System prompt
 * @param {string} opts.userText – User message
 * @param {function} opts.onDelta  – Called with each text token
 * @param {function} [opts.onPhase] – Called when the AI phase changes (connecting/thinking/writing/streaming)
 * @param {AbortSignal} [opts.signal] – Abort signal
 * @param {number} [opts.retries=2] – Number of retries on network failure
 */
export async function streamClaudeJson({ system, userText, onDelta, onPhase, signal, retries = 2 }) {
  const TIMEOUT_MS = 25000; // 25s connection timeout
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      // Compose signal: merge user signal and timeout signal
      const mergedSignal = signal
        ? mergeAbortSignals(signal, controller.signal)
        : controller.signal;

      onPhase?.("connecting");

      const res = await fetch("http://localhost:8000/api/ai/stream", {
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

      // If we reach here, stream ended without explicit done
      return;
    } catch (e) {
      lastError = e;

      // Don't retry on user abort
      if (e?.name === "AbortError" && signal?.aborted) {
        throw e;
      }

      // Don't retry on server-reported errors (they won't change)
      if (e?.message?.includes("AI stream error") || e?.message?.includes("AI stream failed")) {
        throw e;
      }

      // Retry on network errors
      if (attempt < retries) {
        const delay = (attempt + 1) * 1500; // 1.5s, 3s
        onPhase?.("retrying", `Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error("AI request failed after retries. Is Ollama running?");
}

/**
 * Merge two AbortSignals — the resulting signal aborts if either input does.
 */
function mergeAbortSignals(a, b) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

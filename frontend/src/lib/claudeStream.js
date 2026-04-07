export async function streamClaudeJson({ system, userText, onDelta, signal }) {
  const res = await fetch("http://localhost:8000/api/ai/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system,
      userText
    }),
    signal
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claude stream failed (${res.status}). ${text}`.trim());
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

      if (evt.type === "delta") {
        onDelta?.(evt.text || "");
      } else if (evt.type === "error") {
        throw new Error(evt.error || "Claude stream error.");
      } else if (evt.type === "done") {
        return;
      }
    }
  }
}


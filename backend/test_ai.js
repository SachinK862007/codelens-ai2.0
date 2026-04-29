import http from "node:http";

const body = JSON.stringify({
  system: "You are a coding assistant. Be concise.",
  userText: "Write a Python one-liner that prints Hello World. Reply with ONLY the code line."
});

console.log("Testing AI stream endpoint...\n");

const req = http.request({
  hostname: "localhost",
  port: 8000,
  path: "/api/ai/stream",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  }
}, (res) => {
  console.log("HTTP Status:", res.statusCode);

  let collected = "";
  let tokens = [];

  res.on("data", (chunk) => {
    const text = chunk.toString();
    collected += text;

    // Parse SSE events and extract delta tokens
    const lines = text.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const evt = JSON.parse(line.slice(5).trim());
        if (evt.type === "delta" && evt.text) {
          process.stdout.write(evt.text);
          tokens.push(evt.text);
        }
        if (evt.type === "error") {
          console.error("\n\nERROR from AI:", evt.error);
        }
      } catch { /* ignore */ }
    }
  });

  res.on("end", () => {
    const aiResponse = tokens.join("");
    console.log("\n\n=== TEST RESULT ===");
    if (tokens.length > 0) {
      console.log("✅ SUCCESS: AI is working! Received", tokens.length, "tokens.");
      console.log("AI Response:", aiResponse.trim());
    } else if (collected.includes('"error"')) {
      const match = collected.match(/"error":"([^"]+)"/);
      console.log("❌ FAIL: Error -", match?.[1] || "Unknown error");
    } else {
      console.log("⚠️  No tokens received. Full response:", collected.slice(0, 500));
    }
    process.exit(tokens.length > 0 ? 0 : 1);
  });
});

req.on("error", (e) => {
  console.error("Connection ERROR:", e.message);
  process.exit(1);
});

setTimeout(() => {
  console.log("\nTIMEOUT after 30s — server may be slow or offline.");
  process.exit(1);
}, 30000);

req.write(body);
req.end();

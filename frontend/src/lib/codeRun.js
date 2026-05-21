const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/**
 * Run code on the backend and return stdout/stderr.
 */
export async function runCodeOnServer(language, code, input = "") {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, code, input: input || "" })
  });
  if (!res.ok) return null;
  return res.json();
}

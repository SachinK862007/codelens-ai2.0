import React, { useMemo, useRef, useState } from "react";
import CodeBlock from "../components/CodeBlock.jsx";
import SimpleTerminal from "../components/SimpleTerminal.jsx";
import { streamClaudeJson } from "../lib/claudeStream.js";
import { extractJsonString, safeJsonParse, extractCodeWriterFields } from "../lib/partialJson.js";
import { detectStreamProgress } from "../lib/streamProgress.js";
import AILoadingAnimation, { AISkeletonLoader } from "../components/AILoadingAnimation.jsx";
import Modal from "../components/Modal.jsx";
import mermaid from "mermaid";

function MermaidDiagram({ chart }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && chart) {
      mermaid.initialize({ startOnLoad: false, theme: "dark", background: "transparent" });
      mermaid.render("mermaid-svg-" + Math.floor(Math.random() * 1000000), chart).then((result) => {
        if (ref.current) ref.current.innerHTML = result.svg;
      }).catch(err => {
        if (ref.current) ref.current.innerHTML = `<div class="error">Failed to render flowchart.</div>`;
      });
    }
  }, [chart]);
  return <div ref={ref} style={{ display: "flex", justifyContent: "center", overflow: "auto" }} />;
}

function generateMermaidCode(flowchart) {
  if (!Array.isArray(flowchart) || !flowchart.length) return "";
  let diag = "graph TD\\n";
  flowchart.forEach(n => {
    let shape = n.label || "";
    if (n.type === "start" || n.type === "end") shape = `([${shape}])`;
    else if (n.type === "condition") shape = `{${shape}}`;
    else shape = `[${shape}]`;
    diag += `  ${n.id}${shape}\\n`;
    if (n.next) diag += `  ${n.id} --> ${n.next}\\n`;
  });
  return diag;
}

const LANGUAGES = [
  { id: "c", label: "C", icon: "C" },
  { id: "cpp", label: "C++", icon: "C++" },
  { id: "python", label: "Python", icon: "🐍" },
  { id: "html", label: "HTML", icon: "⌘" },
  { id: "css", label: "CSS", icon: "🎨" },
  { id: "javascript", label: "JavaScript", icon: "JS" },
  { id: "java", label: "Java", icon: "☕" },
  { id: "typescript", label: "TypeScript", icon: "TS" },
  { id: "rust", label: "Rust", icon: "🦀" },
  { id: "go", label: "Go", icon: "Go" },
  { id: "php", label: "PHP", icon: "PHP" },
  { id: "swift", label: "Swift", icon: "Swift" },
  { id: "kotlin", label: "Kotlin", icon: "K" }
];

const SYSTEM_PROMPT = `You are CodeLens.ai Code Writer. Return ONLY a single valid JSON object. No markdown, no prose, no code fences.

CRITICAL JSON ESCAPING RULES — you MUST follow these or the output will be rejected:
1. Every newline inside a string value → write as \\n (backslash + n)
2. Every double quote inside a string value → write as \\" (backslash + quote)
3. Every backslash inside a string value → write as \\\\ (two backslashes)
4. NEVER put a literal newline character inside a JSON string value
5. NEVER put a literal unescaped " inside a JSON string value

Required shape:
{
  "code": "full runnable code with \\n for newlines and \\" for quotes",
  "language": "python",
  "algorithm": ["step 1", "step 2"],
  "logic_explanation": "one paragraph explanation",
  "flowchart": [
    { "id": "1", "label": "Start", "type": "start", "next": "2" },
    { "id": "2", "label": "Process", "type": "process", "next": "3" },
    { "id": "3", "label": "End", "type": "end" }
  ],
  "time_complexity": "O(n)",
  "space_complexity": "O(1)"
}

Additional rules:
- "language" must match the requested language exactly.
- "flowchart" must be a linear chain via "next", starting at id "1", type: start|process|condition|end.
- "code" must be complete and runnable.
- Never include backticks anywhere.`;

function RawFallback({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="card">
      <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Raw Output</span>
        <button className="ghost-button" type="button" onClick={copy} style={{ fontSize: 12, padding: "2px 10px" }}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, margin: 0, maxHeight: 480, overflowY: "auto" }}>
        {text}
      </pre>
    </div>
  );
}

export default function ModelCodeWriter({ onSaveHistory }) {
  const [language, setLanguage] = useState("python");
  const [description, setDescription] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [liveLogic, setLiveLogic] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("thinking");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [streamProgress, setStreamProgress] = useState([]);
  const [rawFallback, setRawFallback] = useState("");
  const abortRef = useRef(null);
  const terminalRef = useRef(null);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [algoOpen, setAlgoOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  const langMeta = useMemo(
    () => LANGUAGES.find((l) => l.id === language) || LANGUAGES[0],
    [language]
  );

  const run = async ({ nextLanguage } = {}) => {
    const lang = nextLanguage || language;
    const prompt = (description || "").trim();
    if (!prompt) {
      setError("Describe what code you want first.");
      return;
    }

    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError("");
    setData(null);
    setLiveLogic("");
    setPhase("thinking");
    setPhaseLabel("");
    setStreamProgress([]);
    setRawFallback("");

    const userText = `Language: ${lang}\n\nTask:\n${prompt}\n\nReturn the JSON only.`;
    let collected = "";

    try {
      await streamClaudeJson({
        system: SYSTEM_PROMPT,
        userText,
        signal: ac.signal,
        onPhase: (p, label) => {
          setPhase(p);
          if (label) setPhaseLabel(label);
        },
        onDelta: (t) => {
          collected += t;
          const logic = extractJsonString(collected, "logic_explanation");
          if (logic != null) setLiveLogic(logic);
          setStreamProgress(detectStreamProgress(collected, "codewriter"));
        }
      });

      const finalParsed = safeJsonParse(collected) || extractCodeWriterFields(collected);
      if (finalParsed) {
        setData(finalParsed);
        onSaveHistory?.({
          title: "Code Writer",
          prompt: `${lang}: ${prompt}`.slice(0, 220),
          response: (finalParsed.code || "").slice(0, 220)
        });
      } else {
        setRawFallback(collected);
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = () => run();
  const onRegenerate = () => run();
  const onChangeLanguage = () => run({ nextLanguage: language });

  return (
    <div className="model-grid">
      <div className="panel">
        <div className="panel-title">Code Writer</div>
        <div className="panel-subtitle">
          Describe what you want. Get code, algorithm steps, a flowchart, and complexity.
        </div>

        <div className="field-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.icon} {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <label>Request</label>
          <textarea
            className="code-area"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={12}
            placeholder="Describe the complex code or application you want..."
            spellCheck={false}
            disabled={loading}
          />
        </div>

        <div className="field-row">
          <label>Sample Input (Optional)</label>
          <textarea
            className="code-area sample-input-area"
            value={sampleInput}
            onChange={(e) => setSampleInput(e.target.value)}
            rows={4}
            placeholder="Enter mock input to pass to the program when running..."
            spellCheck={false}
            disabled={loading}
          />
        </div>

        <div className="button-row">
          <button className="primary-button" type="button" onClick={onSubmit} disabled={loading}>
            {loading ? "Generating..." : `Generate ${langMeta.label}`}
          </button>
          <button className="ghost-button" type="button" onClick={onRegenerate} disabled={loading || !description.trim()}>
            Regenerate
          </button>
          <button className="ghost-button" type="button" onClick={onChangeLanguage} disabled={loading || !description.trim()}>
            Change Language
          </button>
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            <div className="error-title">Request failed</div>
            <div className="error-body">{error}</div>
            <button className="ghost-button" type="button" onClick={() => run()} disabled={loading}>
              Retry
            </button>
          </div>
        ) : null}

        {loading && (
          <AILoadingAnimation
            phase={phase}
            phaseLabel={phaseLabel}
            variant="codewriter"
            streamProgress={streamProgress}
          />
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Output</div>
        {loading ? (
          <AISkeletonLoader />
        ) : data ? (
          <div className="writer-output ai-result-enter">
            <div className="writer-badges">
              <span className="badge">{data.language || langMeta.label}</span>
              {data.time_complexity ? <span className="badge">Time: {data.time_complexity}</span> : null}
              {data.space_complexity ? <span className="badge">Space: {data.space_complexity}</span> : null}
            </div>

            <CodeBlock title="Generated Code" code={data.code || ""} language={data.language || language} />

            <div className="button-row" style={{ marginTop: 16, marginBottom: 16 }}>
              {Array.isArray(data.algorithm) && data.algorithm.length > 0 && (
                <button className="ghost-button" type="button" onClick={() => setAlgoOpen(true)}>
                  Show Algorithm
                </button>
              )}
              {Array.isArray(data.flowchart) && data.flowchart.length > 0 && (
                <button className="ghost-button" type="button" onClick={() => setFlowOpen(true)}>
                  Show Flowchart
                </button>
              )}
            </div>

            <div className="card">
              <div className="section-label">Logic Explanation</div>
              <p className="para">{data.logic_explanation || liveLogic || "Logic explanation appears here."}</p>
            </div>

            <div className="card terminal-panel">
              <div className="section-label">Run generated code</div>
              <p className="panel-subtitle" style={{ marginTop: 0 }}>
                Interactive terminal — same as Code Runner and Practice.
              </p>
              <button
                className="primary-button"
                type="button"
                style={{ marginBottom: 10 }}
                onClick={() => {
                  setTerminalVisible(true);
                  terminalRef.current?.run?.();
                }}
                disabled={!data.code}
              >
                Run in terminal
              </button>
              <SimpleTerminal
                ref={terminalRef}
                code={data.code || ""}
                language={data.language || language}
                visible={terminalVisible}
                onVisibilityChange={setTerminalVisible}
                initialStdin={sampleInput}
              />
            </div>
          </div>
        ) : rawFallback ? (
          <RawFallback text={rawFallback} />
        ) : (
          <div className="empty-state">Generate code to see structured output.</div>
        )}
      </div>

      <Modal open={algoOpen} title="Algorithm Logic" onClose={() => setAlgoOpen(false)}>
        {data && Array.isArray(data.algorithm) ? (
          <ol className="steps-list numbered" style={{ margin: 0 }}>
            {data.algorithm.map((s, idx) => (
              <li key={`${idx}-${s}`}>{s}</li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">No algorithm steps provided.</div>
        )}
      </Modal>

      <Modal open={flowOpen} title="Execution Flowchart" onClose={() => setFlowOpen(false)}>
        {data && Array.isArray(data.flowchart) ? (
          <MermaidDiagram chart={generateMermaidCode(data.flowchart)} />
        ) : (
          <div className="empty-state">No flowchart provided.</div>
        )}
      </Modal>
    </div>
  );
}

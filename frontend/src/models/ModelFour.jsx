import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { streamClaudeJson } from "../lib/claudeStream.js";
import { PRACTICE_LANGUAGES, PRACTICE_QUESTIONS } from "../data/practiceQuestions.js";
import { extractJsonBool, extractJsonString, safeJsonParse } from "../lib/partialJson.js";
import AILoadingAnimation from "../components/AILoadingAnimation.jsx";

const SYSTEM_PROMPT = `Evaluate if the user's code correctly solves the problem.
Output comparison is CASE INSENSITIVE. Check the LOGIC, not exact character match.
Return JSON only: { "passed": true/false, "feedback": "...", "hint": "..." }.
Do not reveal the final full answer code.`;

function ordered(arr) {
  return [...arr];
}

export default function ModelFour({ onSaveHistory }) {
  const [language, setLanguage] = useState("python");
  const [order, setOrder] = useState(() => ordered(PRACTICE_QUESTIONS.python));
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [liveFeedback, setLiveFeedback] = useState("");
  const [liveHint, setLiveHint] = useState("");
  const [livePassed, setLivePassed] = useState(null);
  const [error, setError] = useState("");
  const [passedFlash, setPassedFlash] = useState(false);
  const abortRef = useRef(null);
  const advanceTimerRef = useRef(null);

  useEffect(() => {
    setOrder(ordered(PRACTICE_QUESTIONS[language] || []));
    setIndex(0);
    setCode("");
    setResult(null);
    setError("");
  }, [language]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const question = useMemo(() => order[index], [order, index]);
  const total = order.length || 1;
  const progress = Math.round(((index) / total) * 100);

  const runCheck = async () => {
    if (!question) return;
    const src = (code || "").trim();
    if (!src) {
      setError("Write your solution first.");
      return;
    }

    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError("");
    setResult(null);
    setPassedFlash(false);
    setLiveFeedback("");
    setLiveHint("");
    setLivePassed(null);

    const userText = `Language: ${language}
Problem:
${question.statement}
Expected behavior (NOT exact string):
${question.expectedBehavior}

User code:
${src}`;

    let collected = "";
    try {
      await streamClaudeJson({
        system: SYSTEM_PROMPT,
        userText,
        signal: ac.signal,
        onDelta: (t) => {
          collected += t;
          // Extract partial values for live feedback while streaming
          const fb = extractJsonString(collected, "feedback");
          const hint = extractJsonString(collected, "hint");
          const passed = extractJsonBool(collected, "passed");
          if (fb != null) setLiveFeedback(fb);
          if (hint != null) setLiveHint(hint);
          if (passed != null) setLivePassed(passed);
        }
      });

      const parsed = safeJsonParse(collected);
      if (parsed) {
        setResult(parsed);

        onSaveHistory?.({
          title: parsed.passed ? "Practice passed" : "Practice failed",
          prompt: `${language} • ${question.title}`,
          response: parsed.feedback || ""
        });

        if (parsed.passed) {
          setPassedFlash(true);
          advanceTimerRef.current = window.setTimeout(() => {
            setPassedFlash(false);
            setIndex((p) => Math.min(p + 1, total - 1));
            setCode("");
            setResult(null);
          }, 2000);
        }
      } else {
        // Use extracted values even if full parse failed
        if (liveFeedback) {
          setResult({ passed: livePassed || false, feedback: liveFeedback, hint: liveHint || "" });
        } else {
          setError("AI response could not be parsed. Please try again.");
        }
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Run & Check failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="model-grid">
      <div className="panel">
        <div className="panel-title">Practice Arena</div>
        <div className="panel-subtitle">
          VS Code-style practice with Monaco Editor. Run & Check grades logic (case-insensitive), not exact output.
        </div>

        <div className="field-row">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading}>
            {PRACTICE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="practice-progress">
          <div className="practice-progress-top">
            <span className="badge">Question {index + 1}/{total}</span>
            <span className="badge">Progress {progress}%</span>
          </div>
          <div className="practice-progress-bar">
            <div className="practice-progress-fill" style={{ width: `${(index / total) * 100}%` }} />
          </div>
        </div>

        {question ? (
          <div className="level-card">
            <div className="level-title">{question.title}</div>
            <div className="level-prompt">{question.statement}</div>
            <div className="level-prompt" style={{ marginTop: 8 }}>
              <span className="badge">Expected behavior</span>
              <div style={{ marginTop: 6 }}>{question.expectedBehavior}</div>
            </div>
          </div>
        ) : (
          <div className="empty-state">No questions loaded for this language.</div>
        )}

        <div className={`practice-editor ${passedFlash ? "passed" : ""}`}>
          <Editor
            height="360px"
            language={language === "cpp" ? "cpp" : language}
            value={code}
            onChange={(v) => setCode(v || "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: "on",
              automaticLayout: true,
              scrollBeyondLastLine: false
            }}
          />
        </div>

        <button className="primary-button" type="button" onClick={runCheck} disabled={loading || !question}>
          {loading ? "Checking..." : "Run & Check"}
        </button>

        {error ? (
          <div className="error-banner" role="alert">
            <div className="error-title">Request failed</div>
            <div className="error-body">{error}</div>
            <button className="ghost-button" type="button" onClick={runCheck} disabled={loading}>
              Retry
            </button>
          </div>
        ) : null}

        {loading && (
          <AILoadingAnimation
            message="Evaluating your solution..."
            subtext="Checking logic and correctness"
          />
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Feedback</div>
        {result || (liveFeedback && loading) ? (
          <div className="output-card ai-result-enter">
            <div className={`status-pill ${((result?.passed ?? livePassed) ? "ok" : "fail")}`}>
              {(result?.passed ?? livePassed) ? "Passed" : "Try Again"}
            </div>
            <div className="section-label">What happened</div>
            <p className="para">{result?.feedback || liveFeedback || (loading ? "Checking your logic..." : "")}</p>
            {(result?.hint || liveHint) ? (
              <>
                <div className="section-label">Hint</div>
                <p className="hint">{result?.hint || liveHint}</p>
              </>
            ) : null}
            {!(result?.passed ?? livePassed) ? (
              <div className="empty-state" style={{ marginTop: 10 }}>
                Fix your code and retry — we won't reveal the answer.
              </div>
            ) : result || livePassed ? (
              <div className="empty-state" style={{ marginTop: 10 }}>
                Nice. Moving to the next question in 2 seconds…
              </div>
            ) : null}

            <div className="button-row" style={{ marginTop: 10 }}>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
                  setPassedFlash(false);
                  setIndex((p) => Math.min(p + 1, total - 1));
                  setCode("");
                  setResult(null);
                  setLiveFeedback("");
                  setLiveHint("");
                  setLivePassed(null);
                }}
                disabled={loading || !(result?.passed ?? livePassed) || index >= total - 1}
              >
                Next level
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">Run a check to see feedback and hints.</div>
        )}
      </div>
    </div>
  );
}

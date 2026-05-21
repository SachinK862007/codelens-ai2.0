import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { streamClaudeJson } from "../lib/claudeStream.js";
import { PRACTICE_LANGUAGES, PRACTICE_QUESTIONS } from "../data/practiceQuestions.js";
import { detectStreamProgress } from "../lib/streamProgress.js";
import { parsePracticeResponse } from "../lib/practiceParse.js";
import { tryLocalPracticeGrade } from "../lib/practiceGrade.js";
import AILoadingAnimation from "../components/AILoadingAnimation.jsx";
import AIResponseCard from "../components/AIResponseCard.jsx";

const SYSTEM_PROMPT = `You are CodeLens Practice Grader. Reply with ONLY one JSON object — no markdown, no explanation before or after.

{"passed":true,"feedback":"short sentence","hint":"short hint or empty string"}

Rules:
- Grade LOGIC and behavior, NOT exact output text, spacing, or punctuation.
- Output comparison is CASE INSENSITIVE.
- Accept any correct approach (different variable names, formatting, or wording).
- For greeting tasks: any clear greeting output passes (Hello, Hi, etc.).
- passed must be boolean true or false only.
- Do not include the full solution code in feedback or hint.`;

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
  const [phase, setPhase] = useState("thinking");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [streamProgress, setStreamProgress] = useState([]);
  const [rawFallback, setRawFallback] = useState("");
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

  const scheduleAdvance = () => {
    setPassedFlash(true);
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = window.setTimeout(() => {
      setPassedFlash(false);
      setIndex((p) => Math.min(p + 1, total - 1));
      setCode("");
      setResult(null);
      setLiveFeedback("");
      setLiveHint("");
      setLivePassed(null);
    }, 2000);
  };

  const applyEvaluation = (evaluation) => {
    setResult(evaluation);
    setRawFallback("");

    onSaveHistory?.({
      title: evaluation.passed ? "Practice passed" : "Practice failed",
      prompt: `${language} • ${question?.title || "Practice"}`,
      response: evaluation.feedback || ""
    });

    if (evaluation.passed) {
      scheduleAdvance();
    }
  };

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
    setPhase("thinking");
    setPhaseLabel("");
    setStreamProgress([]);
    setRawFallback("");

    const userText = `Language: ${language}
Problem:
${question.statement}
Expected behavior (NOT exact string):
${question.expectedBehavior}

User code:
${src}`;

    // Fast local check (runs code, grades logic — no Ollama wait for simple tasks)
    setPhase("thinking");
    setPhaseLabel("Running your code...");
    const localGrade = await tryLocalPracticeGrade(language, src, question);
    if (localGrade) {
      applyEvaluation(localGrade);
      setLoading(false);
      return;
    }

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
          const partial = parsePracticeResponse(collected);
          if (partial) {
            if (partial.feedback) setLiveFeedback(partial.feedback);
            setLiveHint(partial.hint || "");
            setLivePassed(partial.passed);
          }
          setStreamProgress(detectStreamProgress(collected, "practice"));
        }
      });

      const evaluation = parsePracticeResponse(collected);
      if (evaluation) {
        applyEvaluation(evaluation);
      } else {
        setRawFallback(collected);
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
            phase={phase}
            phaseLabel={phaseLabel}
            variant="practice"
            streamProgress={streamProgress}
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
                  setRawFallback("");
                }}
                disabled={loading || !(result?.passed ?? livePassed) || index >= total - 1}
              >
                Next level
              </button>
            </div>
          </div>
        ) : rawFallback ? (
          <AIResponseCard text={rawFallback} variant="practice" />
        ) : (
          <div className="empty-state">Run a check to see feedback and hints.</div>
        )}
      </div>
    </div>
  );
}

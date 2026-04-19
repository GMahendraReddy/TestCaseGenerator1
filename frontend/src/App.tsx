import { useCallback, useState } from "react";
import "./App.css";

function getApiBase(): string {
  const v = import.meta.env.VITE_API_URL;
  if (v && typeof v === "string" && v.trim()) {
    return v.replace(/\/$/, "");
  }
  return "";
}

export default function App() {
  const [userStory, setUserStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    const trimmed = userStory.trim();
    if (!trimmed) {
      setError("Enter a user story or feature description.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const base = getApiBase();
      const url = base ? `${base}/generate` : "/api/generate";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userStory: trimmed }),
      });

      if (!res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        throw new Error(`Request failed (${res.status})`);
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      let filename = "test-cases.xlsx";
      const match = cd?.match(/filename="?([^";]+)"?/i);
      if (match?.[1]) filename = match[1];

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [userStory]);

  return (
    <div className="app">
      <h1>Test case generator</h1>
      <p className="subtitle">
        Describe a user story; the backend uses OpenRouter to draft test cases
        and returns an Excel file.
      </p>

      <div className="field">
        <label htmlFor="story">User story</label>
        <textarea
          id="story"
          className="story-input"
          value={userStory}
          onChange={(e) => setUserStory(e.target.value)}
          placeholder="As a user, I want to..."
          disabled={loading}
          rows={8}
        />
      </div>

      <div className="actions">
        <button
          type="button"
          className="generate-btn"
          onClick={generate}
          disabled={loading}
        >
          {loading && <span className="spinner" aria-hidden />}
          {loading ? "Generating…" : "Generate Test Cases"}
        </button>
        <p className="hint">Requires a running API and valid OPENROUTER_API_KEY.</p>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

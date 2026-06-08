import { useEffect, useRef, useState, useCallback } from "react";
import "./console.scss";

interface LogEntry {
  ts: number;
  level: string;
  scope: string;
  text: string;
}

const LEVEL_COLORS: Record<string, string> = {
  error: "#f87171",
  warn: "#fb923c",
  info: "#60a5fa",
  verbose: "#a78bfa",
  debug: "#94a3b8",
  silly: "#64748b",
};

function fmt(ts: number) {
  const d = new Date(ts);
  return (
    d.getHours().toString().padStart(2, "0") +
    ":" +
    d.getMinutes().toString().padStart(2, "0") +
    ":" +
    d.getSeconds().toString().padStart(2, "0") +
    "." +
    d.getMilliseconds().toString().padStart(3, "0")
  );
}

export default function ConsolePage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = window.electron.onConsoleLog((entry: LogEntry) => {
      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > 5000 ? next.slice(-5000) : next;
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [entries, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  }, []);

  const filtered = entries.filter((e) => {
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (
        e.text.toLowerCase().includes(q) || e.scope.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="console">
      <div className="console__toolbar">
        <span className="console__title">Debug Console</span>
        <select
          className="console__level-select"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
        >
          <option value="all">All levels</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
          <option value="verbose">verbose</option>
          <option value="debug">debug</option>
          <option value="silly">silly</option>
        </select>
        <input
          className="console__filter"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          className="console__clear-btn"
          onClick={() => setEntries([])}
          type="button"
        >
          Clear
        </button>
        <button
          className={`console__scroll-btn ${autoScroll ? "console__scroll-btn--active" : ""}`}
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          type="button"
          title="Scroll to bottom"
        >
          ↓
        </button>
      </div>
      <div className="console__body" ref={containerRef} onScroll={handleScroll}>
        {filtered.map((e, i) => (
          <div key={i} className={`console__line console__line--${e.level}`}>
            <span className="console__ts">{fmt(e.ts)}</span>
            <span className="console__scope">[{e.scope}]</span>
            <span
              className="console__level"
              style={{ color: LEVEL_COLORS[e.level] ?? "#94a3b8" }}
            >
              {e.level.toUpperCase()}
            </span>
            <span className="console__text">{e.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="console__statusbar">
        {filtered.length} / {entries.length} entries
        {!autoScroll && (
          <span className="console__paused"> — scrolling paused</span>
        )}
      </div>
    </div>
  );
}

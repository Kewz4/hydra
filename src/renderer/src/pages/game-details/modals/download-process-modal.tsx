import { useEffect, useRef, useState } from "react";
import { Modal, Button } from "@renderer/components";

interface LogLine {
  text: string;
  isError: boolean;
}

interface DownloadProcessModalProps {
  visible: boolean;
  title: string;
  objectId: string;
  launcher: "legendary" | "gogdl";
  onClose: () => void;
}

export function DownloadProcessModal({
  visible,
  title,
  objectId,
  launcher,
  onClose,
}: Readonly<DownloadProcessModalProps>) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [isDone, setIsDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) {
      setLines([]);
      setIsDone(false);
      return;
    }

    const handler = (value: { objectId: string; line: string; isError: boolean }) => {
      if (value.objectId !== objectId) return;
      setLines((prev) => [...prev, { text: value.line, isError: value.isError }]);
      if (value.line.startsWith("✓") || value.line.startsWith("✗")) {
        setIsDone(true);
      }
    };

    const unsub =
      launcher === "legendary"
        ? window.electron.onLegendaryProcessLog(handler)
        : window.electron.onGogdlProcessLog(handler);

    return () => {
      unsub();
    };
  }, [visible, objectId, launcher]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <Modal
      visible={visible}
      title={`Downloading: ${title}`}
      description={`via ${launcher === "legendary" ? "Epic (Legendary)" : "GOG (gogdl)"}`}
      onClose={onClose}
    >
      <div
        ref={scrollRef}
        style={{
          fontFamily: "monospace",
          fontSize: "0.78rem",
          background: "rgba(0,0,0,0.4)",
          borderRadius: 6,
          padding: "10px 12px",
          height: 280,
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {lines.length === 0 && (
          <span style={{ opacity: 0.45 }}>Waiting for process output…</span>
        )}
        {lines.map((l, i) => (
          <span
            key={i}
            style={{ color: l.isError ? "var(--color-danger, #f87171)" : "inherit" }}
          >
            {l.text}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {isDone ? (
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        ) : (
          <span style={{ fontSize: "0.8rem", opacity: 0.6, alignSelf: "center" }}>
            Download in progress — you can close this window, it will continue in the background.
          </span>
        )}
      </div>
    </Modal>
  );
}

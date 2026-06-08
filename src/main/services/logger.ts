import { logsPath } from "@main/constants";
import log from "electron-log";
import path from "path";

log.transports.file.resolvePathFn = (
  _: log.PathVariables,
  message?: log.LogMessage | undefined
) => {
  if (message?.scope === "python-rpc") {
    return path.join(logsPath, "pythonrpc.txt");
  }

  if (message?.scope === "network") {
    return path.join(logsPath, "network.txt");
  }

  if (message?.scope == "achievements") {
    return path.join(logsPath, "achievements.txt");
  }

  if (message?.level === "error") {
    return path.join(logsPath, "error.txt");
  }

  if (message?.level === "info") {
    return path.join(logsPath, "info.txt");
  }

  return path.join(logsPath, "logs.txt");
};

// IPC transport — streams every log entry to the console window in real-time.
// The transport is registered lazily so ipcMain is available.
let _consoleWindowSend: ((entry: ConsoleLogEntry) => void) | null = null;

export interface ConsoleLogEntry {
  ts: number;
  level: string;
  scope: string;
  text: string;
}

export function setConsoleWindowSender(
  fn: ((entry: ConsoleLogEntry) => void) | null
) {
  _consoleWindowSend = fn;
}

const ipcTransport: log.Transport = (message) => {
  if (!_consoleWindowSend) return;
  const text = message.data
    .map((d) => (typeof d === "string" ? d : JSON.stringify(d)))
    .join(" ");
  _consoleWindowSend({
    ts: message.date.getTime(),
    level: message.level,
    scope: (message.scope as string) || "main",
    text,
  });
};
ipcTransport.level = "silly";
log.transports["consoleWindow"] = ipcTransport;

log.errorHandler.startCatching({
  showDialog: false,
});

log.initialize();

export const pythonRpcLogger = log.scope("python-rpc");
export const logger = log.scope("main");
export const achievementsLogger = log.scope("achievements");
export const networkLogger = log.scope("network");

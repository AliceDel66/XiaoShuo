import { useState, useCallback } from "react";
import { AuthPage, getStoredAuth } from "./components/auth/AuthPage";
import { WorkbenchApp } from "./components/workbench/WorkbenchApp";
import { DramaApp } from "./components/drama/DramaApp";

type WorkspaceMode = "novel" | "drama";

export function App() {
  const [authorized, setAuthorized] = useState(() => Boolean(getStoredAuth()));
  const [mode, setMode] = useState<WorkspaceMode>("novel");

  const handleAuthorized = useCallback(() => {
    setAuthorized(true);
  }, []);

  if (!authorized) {
    return <AuthPage onAuthorized={handleAuthorized} />;
  }

  const api = window.workbench;

  return mode === "novel" ? (
    <WorkbenchApp api={api} onSwitchMode={() => setMode("drama")} />
  ) : (
    <DramaApp api={api} onSwitchMode={() => setMode("novel")} />
  );
}

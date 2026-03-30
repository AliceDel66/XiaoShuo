import { useState, useCallback } from "react";
import { AuthPage, getStoredAuth } from "./components/auth/AuthPage";
import { WorkbenchApp } from "./components/workbench/WorkbenchApp";

export function App() {
  const [authorized, setAuthorized] = useState(() => Boolean(getStoredAuth()));

  const handleAuthorized = useCallback(() => {
    setAuthorized(true);
  }, []);

  if (!authorized) {
    return <AuthPage onAuthorized={handleAuthorized} />;
  }

  return <WorkbenchApp api={window.workbench} />;
}

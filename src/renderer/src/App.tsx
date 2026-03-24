import { WorkbenchApp } from "./components/workbench/WorkbenchApp";

export function App() {
  return <WorkbenchApp api={window.workbench} />;
}

import type { WorkbenchHookResult } from "./types";
import { DashboardCards } from "./dashboard/DashboardCards";
import { DashboardSidebar } from "./dashboard/DashboardSidebar";
import { DashboardStudio } from "./dashboard/DashboardStudio";

export function DashboardView({ state, actions }: WorkbenchHookResult) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <DashboardSidebar state={state} actions={actions} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-[#0b0f17] p-6">
        <DashboardCards state={state} actions={actions} />
        <DashboardStudio state={state} actions={actions} />
      </main>
    </div>
  );
}

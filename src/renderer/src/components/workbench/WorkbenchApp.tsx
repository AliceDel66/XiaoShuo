import {
  BookOpen,
  Camera,
  Database,
  PenTool,
  Settings,
  Sparkles,
  LayoutDashboard
} from "lucide-react";
import { DashboardView } from "./DashboardView";
import { DatabaseView } from "./DatabaseView";
import { EditorView } from "./EditorView";
import { OutlineView } from "./OutlineView";
import { SettingsView } from "./SettingsView";
import type { WorkbenchAppProps } from "./types";
import { useWorkbenchState } from "./useWorkbenchState";
import { NavButton, StatusPill } from "./ui";
import { WORKBENCH_VIEW_LABELS } from "./view-model";
import { WorkbenchDrawer } from "./WorkbenchDrawer";

const navItems = [
  { id: "dashboard", label: WORKBENCH_VIEW_LABELS.dashboard, icon: <LayoutDashboard size={22} /> },
  { id: "editor", label: WORKBENCH_VIEW_LABELS.editor, icon: <PenTool size={22} /> },
  { id: "outline", label: WORKBENCH_VIEW_LABELS.outline, icon: <BookOpen size={22} /> },
  { id: "database", label: WORKBENCH_VIEW_LABELS.database, icon: <Database size={22} /> },
  { id: "settings", label: WORKBENCH_VIEW_LABELS.settings, icon: <Settings size={22} /> }
] as const;

export function WorkbenchApp({ api, onSwitchMode }: WorkbenchAppProps) {
  const { state, actions } = useWorkbenchState(api);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#090b11] text-slate-200 selection:bg-cyan-500/20">
      <aside className="z-30 flex w-16 shrink-0 flex-col items-center border-r border-white/6 bg-[#07090f] py-6">
        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 text-lg font-bold text-slate-950 shadow-[0_12px_40px_rgba(14,165,233,0.35)]">
          N
        </div>
        <nav className="flex flex-1 flex-col gap-4">
          {navItems.slice(0, 4).map((item) => (
            <NavButton
              key={item.id}
              active={state.activeView === item.id}
              label={item.label}
              icon={item.icon}
              onClick={() => actions.setActiveView(item.id)}
            />
          ))}
        </nav>
        <NavButton
          active={state.activeView === "settings"}
          label={WORKBENCH_VIEW_LABELS.settings}
          icon={<Settings size={22} />}
          onClick={() => actions.setActiveView("settings")}
        />
        {onSwitchMode ? (
          <button
            type="button"
            onClick={onSwitchMode}
            title="切换到短剧工作台"
            className="mt-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 text-orange-400 transition hover:bg-orange-500/20"
          >
            <Camera size={18} />
          </button>
        ) : null}
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-white/6 bg-[#0b0f17]/80 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-white">{WORKBENCH_VIEW_LABELS[state.activeView]}</div>
            {state.selectedProject ? <div className="text-sm text-slate-500">/ {state.selectedProject.manifest.title}</div> : null}
          </div>
          <div className="flex items-center gap-3">
            {state.notice ? <StatusPill tone="success">{state.notice}</StatusPill> : null}
            {state.error ? <StatusPill tone="danger">{state.error}</StatusPill> : null}
            {state.activeJob ? <StatusPill tone="info">{state.activeJob.progress.message}</StatusPill> : null}
            <button
              type="button"
              onClick={() => void actions.refresh()}
              className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/8"
            >
              刷新
            </button>
          </div>
        </div>

        {state.loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="rounded-3xl border border-white/8 bg-[#141722] px-6 py-5 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-300" />
                正在加载工作台数据...
              </div>
            </div>
          </div>
        ) : state.activeView === "dashboard" ? (
          <DashboardView state={state} actions={actions} />
        ) : state.activeView === "editor" ? (
          <EditorView state={state} actions={actions} />
        ) : state.activeView === "outline" ? (
          <OutlineView state={state} actions={actions} />
        ) : state.activeView === "database" ? (
          <DatabaseView state={state} actions={actions} />
        ) : (
          <SettingsView state={state} actions={actions} />
        )}
      </div>

      <WorkbenchDrawer state={state} actions={actions} />
    </div>
  );
}

import {
  MapPin,
  Users,
  Shirt,
  Zap,
  Camera,
  Download,
  Sparkles,
  LayoutDashboard
} from "lucide-react";
import { useEffect } from "react";
import type { AppApi } from "@shared/types";
import { useDramaState, type DramaTab } from "./useDramaState";
import { DramaBibleOverview } from "./DramaBibleOverview";
import { DramaLocationsPanel } from "./DramaLocationsPanel";
import { DramaCharactersPanel } from "./DramaCharactersPanel";
import { DramaPropsPanel } from "./DramaPropsPanel";
import { DramaHooksPanel } from "./DramaHooksPanel";
import { DramaStoryboardPanel } from "./DramaStoryboardPanel";
import { DramaExportPanel } from "./DramaExportPanel";

const tabs: Array<{ id: DramaTab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "资料库总览", icon: <LayoutDashboard size={18} /> },
  { id: "locations", label: "场地规划", icon: <MapPin size={18} /> },
  { id: "characters", label: "人物卡", icon: <Users size={18} /> },
  { id: "props", label: "服化道", icon: <Shirt size={18} /> },
  { id: "hooks", label: "反转/钩子", icon: <Zap size={18} /> },
  { id: "storyboard", label: "分镜表", icon: <Camera size={18} /> },
  { id: "export", label: "素材导出", icon: <Download size={18} /> }
];

export function DramaApp({ api, projectId }: { api: AppApi; projectId: string | null }) {
  const { state, actions } = useDramaState(api);

  useEffect(() => {
    if (projectId) {
      void actions.loadBible(projectId);
    }
  }, [projectId, actions.loadBible]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/6 bg-[#0f121a] p-3">
        <div className="mb-4 flex items-center gap-2 px-2 pt-1">
          <Camera size={20} className="text-orange-400" />
          <span className="text-sm font-semibold text-white">短剧工作台</span>
        </div>
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => actions.setActiveTab(tab.id)}
              className={[
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition",
                state.activeTab === tab.id
                  ? "border border-orange-400/30 bg-orange-500/12 text-orange-300"
                  : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
              ].join(" ")}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* AI generate button */}
        <div className="mt-auto px-2 pb-2">
          <button
            type="button"
            disabled={state.loading || !projectId}
            onClick={() => void actions.generateDramaBibleAI()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            <Sparkles size={16} />
            AI 一键生成资料库
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-y-auto bg-[#0b0f17] p-6">
        {/* Notice & Error */}
        {state.notice ? (
          <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {state.notice}
          </div>
        ) : null}
        {state.error ? (
          <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {state.error}
          </div>
        ) : null}

        {state.loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 rounded-3xl border border-white/8 bg-[#141722] px-6 py-5 text-sm text-slate-300">
              <Sparkles size={16} className="text-orange-300" />
              正在加载...
            </div>
          </div>
        ) : !projectId ? (
          <div className="flex h-64 items-center justify-center text-slate-500">
            请先在连载控制台选择一个项目
          </div>
        ) : state.activeTab === "overview" ? (
          <DramaBibleOverview state={state} actions={actions} />
        ) : state.activeTab === "locations" ? (
          <DramaLocationsPanel state={state} actions={actions} />
        ) : state.activeTab === "characters" ? (
          <DramaCharactersPanel state={state} actions={actions} />
        ) : state.activeTab === "props" ? (
          <DramaPropsPanel state={state} actions={actions} />
        ) : state.activeTab === "hooks" ? (
          <DramaHooksPanel state={state} actions={actions} />
        ) : state.activeTab === "storyboard" ? (
          <DramaStoryboardPanel state={state} actions={actions} />
        ) : (
          <DramaExportPanel state={state} actions={actions} />
        )}
      </main>
    </div>
  );
}

import {
  MapPin,
  Users,
  Shirt,
  Zap,
  Camera,
  Download,
  Sparkles,
  LayoutDashboard,
  PenTool,
  Settings
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import type { AppApi, DramaDashboardData } from "@shared/types";
import { useDramaState, type DramaTab } from "./useDramaState";
import { DramaBibleOverview } from "./DramaBibleOverview";
import { DramaLocationsPanel } from "./DramaLocationsPanel";
import { DramaCharactersPanel } from "./DramaCharactersPanel";
import { DramaPropsPanel } from "./DramaPropsPanel";
import { DramaHooksPanel } from "./DramaHooksPanel";
import { DramaStoryboardPanel } from "./DramaStoryboardPanel";
import { DramaExportPanel } from "./DramaExportPanel";
import { DramaDashboardView } from "./DramaDashboardView";
import { DramaSettingsView } from "./DramaSettingsView";

type DramaView = "dashboard" | "bible" | "settings";

const bibleTabs: Array<{ id: DramaTab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "资料库总览", icon: <LayoutDashboard size={18} /> },
  { id: "locations", label: "场地规划", icon: <MapPin size={18} /> },
  { id: "characters", label: "人物卡", icon: <Users size={18} /> },
  { id: "props", label: "服化道", icon: <Shirt size={18} /> },
  { id: "hooks", label: "反转/钩子", icon: <Zap size={18} /> },
  { id: "storyboard", label: "分镜表", icon: <Camera size={18} /> },
  { id: "export", label: "素材导出", icon: <Download size={18} /> }
];

export function DramaApp({ api, onSwitchMode }: { api: AppApi; onSwitchMode?: () => void }) {
  const [dashboardData, setDashboardData] = useState<DramaDashboardData | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<DramaView>("dashboard");

  const { state, actions } = useDramaState(api);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDramaDashboardData();
      setDashboardData(data);
      const projects = [...data.projects, ...data.archivedProjects];
      const preferred = data.selectedProject?.manifest.projectId ?? projects[0]?.projectId ?? null;
      if (preferred && !selectedProjectId) {
        setSelectedProjectId(preferred);
      }
    } finally {
      setLoading(false);
    }
  }, [api, selectedProjectId]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      void actions.loadBible(selectedProjectId);
    }
  }, [selectedProjectId, actions.loadBible]);

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentView("bible");
  };

  const dramaProjects = dashboardData ? [...dashboardData.projects, ...dashboardData.archivedProjects] : [];
  const selectedTitle = dramaProjects.find((p) => p.projectId === selectedProjectId)?.title ?? "未选择项目";

  const outerNavItems: Array<{ id: DramaView; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: "项目列表", icon: <LayoutDashboard size={18} /> },
    { id: "bible", label: "剧本工作", icon: <Camera size={18} /> },
    { id: "settings", label: "设置", icon: <Settings size={18} /> }
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#090b11] text-slate-200 selection:bg-orange-500/20">
      {/* Outer icon sidebar */}
      <aside className="z-30 flex w-16 shrink-0 flex-col items-center border-r border-white/6 bg-[#07090f] py-6">
        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 text-lg font-bold text-slate-950 shadow-[0_12px_40px_rgba(245,158,11,0.35)]">
          剧
        </div>
        <nav className="flex flex-1 flex-col gap-4">
          {outerNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => setCurrentView(item.id)}
              className={[
                "flex h-10 w-10 items-center justify-center rounded-xl transition",
                currentView === item.id
                  ? "bg-orange-500/15 text-orange-400"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
              ].join(" ")}
            >
              {item.icon}
            </button>
          ))}
        </nav>
        {onSwitchMode ? (
          <button
            type="button"
            onClick={onSwitchMode}
            title="切换到小说工作台"
            className="mt-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 transition hover:bg-cyan-500/20"
          >
            <PenTool size={18} />
          </button>
        ) : null}
      </aside>

      {/* Main area */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-white/6 bg-[#0b0f17]/80 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-orange-300">短剧工作台</div>
            {currentView === "bible" && selectedProjectId && (
              <div className="text-sm text-slate-500">/ {selectedTitle}</div>
            )}
            {currentView === "settings" && (
              <div className="text-sm text-slate-500">/ 设置</div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {state.notice ? (
              <div className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300">{state.notice}</div>
            ) : null}
            {state.error ? (
              <div className="rounded-xl bg-rose-500/15 px-3 py-1.5 text-xs text-rose-300">{state.error}</div>
            ) : null}
            {/* Project selector (only when in bible view) */}
            {currentView === "bible" && dramaProjects.length > 1 ? (
              <select
                value={selectedProjectId ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setSelectedProjectId(id);
                }}
                className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-slate-300 outline-none"
              >
                {dramaProjects.map((p) => (
                  <option key={p.projectId} value={p.projectId} className="bg-[#141722] text-slate-200">
                    {p.title}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/8"
            >
              刷新
            </button>
          </div>
        </div>

        {/* Content */}
        {currentView === "dashboard" ? (
          <main className="min-w-0 flex-1 overflow-y-auto bg-[#0b0f17] p-6">
            {loading ? (
              <LoadingIndicator />
            ) : dashboardData ? (
              <DramaDashboardView
                api={api}
                dashboardData={dashboardData}
                onRefresh={() => void refresh()}
                onSelectProject={handleSelectProject}
              />
            ) : null}
          </main>
        ) : currentView === "settings" ? (
          <main className="min-w-0 flex-1 overflow-y-auto bg-[#0b0f17] p-6">
            {dashboardData ? (
              <DramaSettingsView
                api={api}
                settings={dashboardData.settings}
                onSaved={() => void refresh()}
              />
            ) : null}
          </main>
        ) : (
          /* Bible view with inner sidebar */
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Inner nav sidebar */}
            <aside className="flex w-48 shrink-0 flex-col border-r border-white/6 bg-[#0f121a] p-3">
              <nav className="space-y-1">
                {bibleTabs.map((tab) => (
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
              <div className="mt-auto px-1 pb-1">
                <button
                  type="button"
                  disabled={state.loading || !selectedProjectId}
                  onClick={() => void actions.generateDramaBibleAI()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  <Sparkles size={16} />
                  AI 一键生成
                </button>
              </div>
            </aside>

            {/* Main content */}
            <main className="min-w-0 flex-1 overflow-y-auto bg-[#0b0f17] p-6">
              {loading || state.loading ? (
                <LoadingIndicator />
              ) : !selectedProjectId ? (
                <div className="flex h-64 flex-col items-center justify-center text-slate-500">
                  <p>请先在项目列表中创建或选择一个项目</p>
                  <button
                    type="button"
                    onClick={() => setCurrentView("dashboard")}
                    className="mt-3 rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-300 transition hover:bg-orange-500/20"
                  >
                    前往项目列表
                  </button>
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
        )}
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-2 rounded-3xl border border-white/8 bg-[#141722] px-6 py-5 text-sm text-slate-300">
        <Sparkles size={16} className="text-orange-300" />
        正在加载...
      </div>
    </div>
  );
}

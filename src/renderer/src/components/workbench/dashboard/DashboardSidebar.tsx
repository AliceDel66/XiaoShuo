import type { ProjectManifest } from "@shared/types";
import type { WorkbenchHookResult } from "../types";
import {
  Field,
  GhostButton,
  Input,
  PrimaryButton,
  SplitLabel,
  StatusPill
} from "../ui";
import { cn } from "../ui";
import { FolderArchive, Trash2 } from "lucide-react";

export function DashboardSidebar({ state, actions }: WorkbenchHookResult) {
  const projects: ProjectManifest[] = state.dashboardData?.projects ?? [];
  const archivedProjects: ProjectManifest[] = state.dashboardData?.archivedProjects ?? [];

  return (
    <aside className="flex w-[290px] shrink-0 flex-col overflow-y-auto border-r border-white/6 bg-[#11141d]">
      <div className="border-b border-white/6 p-5">
        <h2 className="text-base font-semibold text-white">半自动连载工作台</h2>
        <div className="mt-4 rounded-2xl border border-white/8 bg-[#0d1018] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">任务状态</span>
            <StatusPill tone={state.activeJob ? "info" : "neutral"}>
              {state.activeJob ? state.activeJob.progress.message : "当前空闲"}
            </StatusPill>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">告警数量</span>
            <span className="text-sm font-semibold text-amber-300">
              {state.selectedProject?.unresolvedWarnings.length ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-white/6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">项目列表</h3>
          <span className="text-xs text-slate-500">{projects.length}</span>
        </div>
        <div className="space-y-2">
          {projects.map((project) => {
            const active = project.projectId === state.selectedProjectId;
            return (
              <div
                key={project.projectId}
                role="button"
                tabIndex={0}
                onClick={() => void actions.selectProject(project.projectId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void actions.selectProject(project.projectId);
                  }
                }}
                className={cn(
                  "w-full rounded-2xl border p-3 text-left transition",
                  active
                    ? "border-cyan-400/30 bg-cyan-500/10"
                    : "border-white/8 bg-[#0d1018] hover:border-white/14 hover:bg-white/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm font-medium", active ? "text-cyan-200" : "text-slate-100")}>
                      {project.title}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{project.genre}</p>
                  </div>
                  <GhostButton
                    className="h-8 px-2"
                    onClick={(event) => {
                      event.stopPropagation();
                      void actions.archiveProject(project.projectId);
                    }}
                  >
                    <FolderArchive size={14} />
                  </GhostButton>
                </div>
              </div>
            );
          })}
        </div>

        {archivedProjects.length > 0 ? (
          <div className="mt-5">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">归档项目</div>
            <div className="space-y-2">
              {archivedProjects.map((project) => (
                <div key={project.projectId} className="rounded-2xl border border-white/8 bg-black/10 p-3">
                  <SplitLabel title={project.title} meta={project.genre} />
                  <div className="mt-2 flex items-center gap-2">
                    <GhostButton
                      className="px-0 text-cyan-300 hover:bg-transparent"
                      onClick={() => void actions.restoreProject(project.projectId)}
                    >
                      恢复到工作区
                    </GhostButton>
                    <GhostButton
                      className="px-0 text-red-400 hover:bg-transparent"
                      onClick={() => {
                        if (window.confirm(`确定永久删除项目《${project.title}》吗？此操作不可恢复。`)) {
                          void actions.deleteProject(project.projectId);
                        }
                      }}
                    >
                      <Trash2 size={14} className="mr-1" />
                      删除
                    </GhostButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">AI 接入</h3>
          <GhostButton onClick={() => actions.setActiveView("settings")} className="px-0 text-cyan-300 hover:bg-transparent">
            去设置
          </GhostButton>
        </div>
        <div className="space-y-3">
          <Field label="Base URL">
            <Input
              value={state.modelProfileDraft.baseUrl}
              onChange={(event) =>
                actions.setModelProfileDraft((current) => ({
                  ...current,
                  baseUrl: event.target.value
                }))
              }
              placeholder="https://api.openai.com/v1"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Planner">
              <Input
                value={state.modelProfileDraft.plannerModel}
                onChange={(event) =>
                  actions.setModelProfileDraft((current) => ({
                    ...current,
                    plannerModel: event.target.value
                  }))
                }
              />
            </Field>
            <Field label="Writer">
              <Input
                value={state.modelProfileDraft.writerModel}
                onChange={(event) =>
                  actions.setModelProfileDraft((current) => ({
                    ...current,
                    writerModel: event.target.value
                  }))
                }
              />
            </Field>
          </div>
          <PrimaryButton
            className="w-full justify-center"
            disabled={state.busy["save-model-profile"]}
            onClick={() => void actions.saveModelProfile()}
          >
            {state.busy["save-model-profile"] ? "保存中..." : "保存模型配置"}
          </PrimaryButton>
        </div>
      </div>
    </aside>
  );
}

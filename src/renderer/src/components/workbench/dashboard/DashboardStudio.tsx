import { Database, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkbenchHookResult } from "../types";
import { candidateFromSession, premiseArtifactRef, WORKFLOW_ACTION_LABELS } from "../view-model";
import {
  EmptyState,
  Field,
  formatDateTime,
  GhostButton,
  Input,
  PanelHeader,
  PrimaryButton,
  SecondaryButton,
  ShellPanel,
  SplitLabel,
  StatusPill,
  cn
} from "../ui";

const phaseLabels = {
  queued: "排队中",
  preflight: "前置校验",
  retrieval: "检索上下文",
  "prompt-ready": "准备提示词",
  "model-running": "模型生成",
  parsing: "解析结果",
  "candidate-ready": "候选就绪",
  saving: "写回正式文档",
  completed: "已完成",
  failed: "失败"
} as const;

export function DashboardStudio({ state, actions }: WorkbenchHookResult) {
  const [studioTab, setStudioTab] = useState<"process" | "candidates">("process");
  const selectedCandidate = useMemo(
    () => candidateFromSession(state.activePreviewSession, state.activeCandidateId),
    [state.activeCandidateId, state.activePreviewSession]
  );

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_0.45fr]">
        <ShellPanel className="overflow-hidden">
          <PanelHeader
            eyebrow="Generation Studio"
            title="过程可视化、候选预览与正式编辑"
            subtitle="高级能力已收纳到抽屉：Prompt、上下文和正式文档编辑不再占用主舞台。"
            action={
              <div className="flex items-center gap-2">
                <GhostButton onClick={actions.openPromptDrawer} disabled={!state.activePreviewSession}>
                  Prompt
                </GhostButton>
                <GhostButton onClick={actions.openContextDrawer} disabled={!state.activePreviewSession}>
                  Context
                </GhostButton>
                {state.selectedProject ? (
                  <GhostButton onClick={() => void actions.openArtifact(premiseArtifactRef(state.selectedProject!))}>
                    编辑立项
                  </GhostButton>
                ) : null}
              </div>
            }
          />
          <div className="border-b border-white/6 px-4 py-3">
            <div className="flex gap-2">
              {(["process", "candidates"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStudioTab(tab)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    studioTab === tab
                      ? "border border-cyan-400/30 bg-cyan-500/12 text-cyan-200"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  {tab === "process" ? "过程" : "候选版本"}
                </button>
              ))}
            </div>
          </div>

          {studioTab === "process" ? (
            <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="border-r border-white/6 p-5 overflow-y-auto max-h-[520px]">
                <div className="space-y-3">
                  {Object.entries(phaseLabels).map(([phase, label]) => {
                    const currentPhase = state.activeJob?.progress.phase;
                    const ordered = Object.keys(phaseLabels);
                    const currentIndex = currentPhase ? ordered.indexOf(currentPhase) : -1;
                    const phaseIndex = ordered.indexOf(phase);
                    const done = phaseIndex < currentIndex;
                    const active = phaseIndex === currentIndex;
                    return (
                      <div key={phase} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-[#0d1018] px-4 py-3">
                        <div
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            done ? "bg-emerald-400" : active ? "bg-cyan-400" : "bg-slate-600"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-100">{label}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {done ? "已完成" : active ? "进行中" : "待执行"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-5 overflow-y-auto max-h-[520px]">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">步骤日志</h3>
                  <StatusPill tone={state.activePreviewSession?.status === "failed" ? "danger" : "neutral"}>
                    {state.activePreviewSession?.status ?? "idle"}
                  </StatusPill>
                </div>
                <div className="space-y-3">
                  {(state.activePreviewSession?.trace ?? []).length === 0 ? (
                    <EmptyState title="生成开始后展示日志" detail="这里会实时显示 phase trace、警告和 prompt 就绪状态。" />
                  ) : (
                    state.activePreviewSession?.trace.map((entry, index) => (
                      <div key={`${entry.timestamp}-${index}`} className="rounded-2xl border border-white/6 bg-[#0d1018] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-slate-100">{entry.title}</div>
                          <div className="text-xs text-slate-500">{formatDateTime(entry.timestamp)}</div>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{entry.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[0.72fr_1.28fr]">
              <div className="border-r border-white/6 p-5 overflow-y-auto max-h-[600px]">
                <div className="space-y-3">
                  {(state.activePreviewSession?.candidates ?? []).length === 0 ? (
                    <EmptyState title="还没有候选版本" detail="触发工作流后，候选会先进入这里，再由你确认写回正式文档。" />
                  ) : (
                    state.activePreviewSession?.candidates.map((candidate) => {
                      const active = candidate.candidateId === state.activeCandidateId;
                      return (
                        <button
                          key={candidate.candidateId}
                          type="button"
                          onClick={() => actions.setActiveCandidateId(candidate.candidateId)}
                          className={cn(
                            "w-full rounded-2xl border p-4 text-left transition",
                            active
                              ? "border-cyan-400/30 bg-cyan-500/10"
                              : "border-white/8 bg-[#0d1018] hover:bg-white/5"
                          )}
                        >
                          <SplitLabel title={candidate.displayTitle} meta={`版本 ${candidate.versionNumber} · ${formatDateTime(candidate.createdAt)}`} />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex max-h-[600px] min-h-[420px] flex-col p-5">
                {selectedCandidate ? (
                  <>
                    <div>
                      <div className="text-lg font-semibold text-white">{selectedCandidate.displayTitle}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {state.activePreviewSession?.action ? WORKFLOW_ACTION_LABELS[state.activePreviewSession.action] : "候选版本"}
                      </div>
                    </div>
                    <pre className="mt-4 min-h-[200px] max-h-[360px] overflow-y-auto whitespace-pre-wrap break-words rounded-[28px] border border-white/6 bg-[#0d1018] p-5 text-sm leading-7 text-slate-200">
                      {selectedCandidate.renderedContent}
                    </pre>
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-[#0d1018] px-5 py-3">
                      <div className="flex items-center gap-2">
                        <StatusPill tone={state.activePreviewSession?.status === "confirmed" ? "success" : "neutral"}>
                          {state.activePreviewSession?.status === "confirmed" ? "已同步" : "未保存"}
                        </StatusPill>
                        <SecondaryButton disabled={Boolean(state.activeJob)} onClick={() => void actions.regenerateCandidate()}>
                          重生成
                        </SecondaryButton>
                        <GhostButton disabled={Boolean(state.activeJob)} onClick={() => void actions.discardSession()}>
                          丢弃会话
                        </GhostButton>
                      </div>
                      <PrimaryButton
                        disabled={Boolean(state.activeJob) || state.activePreviewSession?.status === "confirmed"}
                        onClick={() => void actions.confirmCandidate(selectedCandidate.candidateId)}
                      >
                        保存到正式文档
                      </PrimaryButton>
                    </div>
                    {state.activePreviewSession ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <SecondaryButton onClick={actions.openPromptDrawer}>
                          <Sparkles size={14} className="mr-1" />
                          查看 Prompt
                        </SecondaryButton>
                        <SecondaryButton onClick={actions.openContextDrawer}>
                          <Database size={14} className="mr-1" />
                          查看 Context
                        </SecondaryButton>
                        <SecondaryButton onClick={() => void actions.openArtifact(state.activePreviewSession!.artifactRef)}>
                          打开正式文档
                        </SecondaryButton>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState title="选择一个候选版本" detail="左侧候选列表会保留历史版本，你可以在这里对比、确认或继续重生成。" />
                )}
              </div>
            </div>
          )}
        </ShellPanel>

        <ShellPanel>
          <PanelHeader eyebrow="Reference Search" title="参考片段检索" subtitle="这里保留真实 corpus 搜索结果。" />
          <div className="max-h-[520px] space-y-4 overflow-y-auto p-5">
            <Field label="检索关键词">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 text-slate-500" size={16} />
                <Input
                  className="pl-9"
                  value={state.searchQuery}
                  onChange={(event) => actions.setSearchQuery(event.target.value)}
                  placeholder="例如：倒计时、系统升级、废墟拾荒者"
                />
              </div>
            </Field>
            <div className="space-y-2">
              {state.searchResults.length === 0 ? (
                <EmptyState title="输入关键词后展示结果" detail="如果你已经选择了参考书，搜索会优先限制在已选语料里。" />
              ) : (
                state.searchResults.map((result) => (
                  <div key={result.chunkId} className="rounded-2xl border border-white/6 bg-[#0d1018] p-4">
                    <div className="text-sm font-medium text-slate-100">{result.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{result.snippet}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </ShellPanel>
      </div>
    </>
  );
}

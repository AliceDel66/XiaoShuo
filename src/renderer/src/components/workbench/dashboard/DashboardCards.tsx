import { useState } from "react";
import type { PremiseCard } from "@shared/types";
import type { WorkbenchHookResult } from "../types";
import { WORKFLOW_ACTION_LABELS } from "../view-model";
import {
  EmptyState,
  Field,
  GhostButton,
  Input,
  PanelHeader,
  PrimaryButton,
  SecondaryButton,
  Select,
  ShellPanel,
  SplitLabel,
  StatusPill,
  Textarea,
  cn
} from "../ui";

const dashboardActions = [
  "generate-project-setup",
  "generate-story-bible",
  "generate-volume-outline",
  "generate-chapter-outline"
] as const;

function PremiseCardSummary({ premiseCard }: { premiseCard: PremiseCard }) {
  return (
    <div className="space-y-3">
      {premiseCard.coreSellingPoints.length > 0 ? (
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">核心卖点</div>
          <div className="space-y-1">
            {premiseCard.coreSellingPoints.slice(0, 4).map((point, index) => (
              <div key={index} className="rounded-xl border border-white/6 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                {point}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {premiseCard.mainConflict ? (
        <div>
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">主线矛盾</div>
          <p className="text-sm leading-6 text-slate-300">{premiseCard.mainConflict}</p>
        </div>
      ) : null}
      {premiseCard.protagonistGrowthCurve.length > 0 ? (
        <div>
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">成长曲线</div>
          <div className="flex flex-wrap gap-1">
            {premiseCard.protagonistGrowthCurve.map((phase, index) => (
              <span key={index} className="rounded-lg border border-cyan-500/20 bg-cyan-500/8 px-2 py-1 text-xs text-cyan-300">
                {phase.length > 20 ? `${phase.slice(0, 20)}…` : phase}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {premiseCard.volumePlan.length > 0 ? (
        <div>
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">卷数规划</div>
          <div className="space-y-1">
            {premiseCard.volumePlan.slice(0, 3).map((plan, index) => (
              <div key={index} className="text-xs leading-5 text-slate-400">
                {plan.length > 60 ? `${plan.slice(0, 60)}…` : plan}
              </div>
            ))}
            {premiseCard.volumePlan.length > 3 ? (
              <div className="text-xs text-slate-500">…还有 {premiseCard.volumePlan.length - 3} 卷</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardCards({ state, actions }: WorkbenchHookResult) {
  const selectedCorpora =
    state.dashboardData?.corpora.filter((corpus) => state.selectedCorpusIds.includes(corpus.corpusId)) ?? [];
  const [showCreateForm, setShowCreateForm] = useState(false);
  const project = state.selectedProject;
  const hasProject = Boolean(project);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <ShellPanel>
        {hasProject && !showCreateForm ? (
          <>
            <PanelHeader
              eyebrow="当前项目"
              title={project!.manifest.title}
              subtitle={project!.manifest.premise || project!.manifest.genre}
              action={
                <GhostButton onClick={() => setShowCreateForm(true)} className="text-cyan-300">
                  新建项目
                </GhostButton>
              }
            />
            <div className="max-h-[520px] space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/6 bg-[#0d1018] p-3 text-center">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">类型</div>
                  <div className="mt-1 text-sm font-medium text-slate-200">{project!.manifest.genre}</div>
                </div>
                <div className="rounded-2xl border border-white/6 bg-[#0d1018] p-3 text-center">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">目标字数</div>
                  <div className="mt-1 text-sm font-medium text-slate-200">{(project!.manifest.targetWords / 10000).toFixed(0)}万</div>
                </div>
                <div className="rounded-2xl border border-white/6 bg-[#0d1018] p-3 text-center">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">卷数</div>
                  <div className="mt-1 text-sm font-medium text-slate-200">{project!.manifest.plannedVolumes} 卷</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/6 bg-[#0d1018] p-3 text-center">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">草稿</div>
                  <div className="mt-1 text-sm font-medium text-emerald-300">{project!.drafts.length} 章</div>
                </div>
                <div className="rounded-2xl border border-white/6 bg-[#0d1018] p-3 text-center">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">章纲</div>
                  <div className="mt-1 text-sm font-medium text-slate-200">{project!.outlines.filter(o => o.level === "chapter").length} 章</div>
                </div>
                <div className="rounded-2xl border border-white/6 bg-[#0d1018] p-3 text-center">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">阶段</div>
                  <div className="mt-1 text-sm font-medium text-cyan-300">{project!.manifest.currentStage}</div>
                </div>
              </div>
              {project!.manifest.premise ? (
                <div className="rounded-2xl border border-white/6 bg-[#0d1018] p-4">
                  <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">一句话构思</div>
                  <p className="text-sm leading-6 text-slate-300">{project!.manifest.premise}</p>
                </div>
              ) : null}
              {project!.premiseCard ? (
                <div className="rounded-2xl border border-cyan-500/10 bg-cyan-500/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">立项卡</div>
                    <StatusPill tone="success">已生成</StatusPill>
                  </div>
                  <PremiseCardSummary premiseCard={project!.premiseCard} />
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">立项卡</div>
                  <p className="text-sm text-slate-400">尚未生成立项卡。在右侧「生成控制」中点击「生成立项」开始。</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <PanelHeader
              eyebrow="Phase 1"
              title="创建小说项目"
              subtitle="创建新项目时会自动继承当前的全局项目默认值。"
              action={
                <div className="flex items-center gap-2">
                  {hasProject ? (
                    <GhostButton onClick={() => setShowCreateForm(false)} className="text-slate-400">
                      返回
                    </GhostButton>
                  ) : null}
                  <PrimaryButton disabled={state.busy["create-project"]} onClick={() => { void actions.createProject(); setShowCreateForm(false); }}>
                    {state.busy["create-project"] ? "创建中..." : "保存/创建"}
                  </PrimaryButton>
                </div>
              }
            />
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="标题">
                  <Input
                    value={state.projectForm.title}
                    onChange={(event) =>
                      actions.setProjectForm((current) => ({
                        ...current,
                        title: event.target.value
                      }))
                    }
                    placeholder="例如：惊悚游戏..."
                  />
                </Field>
                <Field label="类型">
                  <Input
                    value={state.projectForm.genre}
                    onChange={(event) =>
                      actions.setProjectForm((current) => ({
                        ...current,
                        genre: event.target.value
                      }))
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="目标字数">
                  <Input
                    type="number"
                    value={state.projectForm.targetWords}
                    onChange={(event) =>
                      actions.setProjectForm((current) => ({
                        ...current,
                        targetWords: Number(event.target.value || 0)
                      }))
                    }
                  />
                </Field>
                <Field label="计划卷数">
                  <Input
                    type="number"
                    value={state.projectForm.plannedVolumes}
                    onChange={(event) =>
                      actions.setProjectForm((current) => ({
                        ...current,
                        plannedVolumes: Number(event.target.value || 1)
                      }))
                    }
                  />
                </Field>
                <Field label="工作流">
                  <Select
                    value={state.projectForm.workflowMode}
                    onChange={(event) =>
                      actions.setProjectForm((current) => ({
                        ...current,
                        workflowMode: event.target.value as typeof current.workflowMode
                      }))
                    }
                  >
                    <option value="strict">严格流</option>
                    <option value="flexible">自由流</option>
                  </Select>
                </Field>
              </div>
              <Field label="一句话构思">
                <Textarea
                  rows={4}
                  value={state.projectForm.premise}
                  onChange={(event) =>
                    actions.setProjectForm((current) => ({
                      ...current,
                      premise: event.target.value
                    }))
                  }
                  placeholder="主角每次使用能力都会改写别人对他的记忆身份..."
                />
              </Field>
            </div>
          </>
        )}
      </ShellPanel>

      <ShellPanel>
        <PanelHeader
          eyebrow="Workflow"
          title="生成控制"
          subtitle="规划阶段的生成动作。写场景、写章节请在编辑页面操作。"
          action={<StatusPill tone="info">{state.selectedProject?.manifest.workflowMode === "strict" ? "严格流" : "自由流"}</StatusPill>}
        />
        <div className="space-y-4 p-5">
          <Field label="工作流备注">
            <Textarea
              rows={2}
              value={state.workflowDraft.notes}
              onChange={(event) =>
                actions.setWorkflowDraft((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              placeholder="例如：希望主角形象更阴郁，冲突要更尖锐。"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {dashboardActions.map((action) => (
              <SecondaryButton
                key={action}
                disabled={!state.selectedProject || Boolean(state.activeJob)}
                onClick={() => void actions.startWorkflow(action)}
                className="justify-center"
              >
                {WORKFLOW_ACTION_LABELS[action]}
              </SecondaryButton>
            ))}
          </div>
        </div>
      </ShellPanel>

      <ShellPanel>
        <PanelHeader eyebrow="Reference" title="参考书与检索" subtitle="先选书，再在主舞台里触发生成。" />
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            {selectedCorpora.length === 0 ? (
              <EmptyState title="还没有选中的参考书" detail="导入 TXT 后点击书卡加入下一次生成。" />
            ) : (
              selectedCorpora.map((corpus) => (
                <button
                  key={corpus.corpusId}
                  type="button"
                  onClick={() => actions.toggleCorpus(corpus.corpusId)}
                  className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-left"
                >
                  <div className="text-sm font-medium text-emerald-300">{corpus.title}</div>
                  <div className="mt-1 text-xs text-emerald-400/80">已用于下一次生成</div>
                </button>
              ))
            )}
          </div>

          {(state.dashboardData?.corpora.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {state.dashboardData?.corpora.map((corpus) => {
                const active = state.selectedCorpusIds.includes(corpus.corpusId);
                return (
                  <button
                    key={corpus.corpusId}
                    type="button"
                    onClick={() => actions.toggleCorpus(corpus.corpusId)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition",
                      active
                        ? "border-cyan-400/20 bg-cyan-500/10"
                        : "border-white/8 bg-[#0d1018] hover:bg-white/5"
                    )}
                  >
                    <SplitLabel
                      title={corpus.title}
                      meta={`${corpus.sourceType === "builtin" ? "内置样例" : corpus.encoding} / ${corpus.chapterPattern}`}
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState title="还没有参考书" detail="导入 TXT 或使用内置样例后，这里会出现可选书卡。" />
          )}
        </div>
      </ShellPanel>
    </div>
  );
}

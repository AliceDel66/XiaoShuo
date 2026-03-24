import type { WorkbenchHookResult } from "../types";
import { WORKFLOW_ACTION_LABELS } from "../view-model";
import {
  EmptyState,
  Field,
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
  "generate-chapter-outline",
  "write-scene",
  "write-chapter"
] as const;

export function DashboardCards({ state, actions }: WorkbenchHookResult) {
  const selectedCorpora =
    state.dashboardData?.corpora.filter((corpus) => state.selectedCorpusIds.includes(corpus.corpusId)) ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <ShellPanel>
        <PanelHeader
          eyebrow="Phase 1"
          title="创建小说项目"
          subtitle="创建新项目时会自动继承当前的全局项目默认值。"
          action={
            <PrimaryButton disabled={state.busy["create-project"]} onClick={() => void actions.createProject()}>
              {state.busy["create-project"] ? "创建中..." : "保存/创建"}
            </PrimaryButton>
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
      </ShellPanel>

      <ShellPanel>
        <PanelHeader
          eyebrow="Workflow"
          title="生成控制"
          subtitle="所有动作继续走原有 workflow 与候选确认流程。"
          action={<StatusPill tone="info">{state.selectedProject?.manifest.workflowMode === "strict" ? "严格流" : "自由流"}</StatusPill>}
        />
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            <Field label="卷号">
              <Input
                type="number"
                min={1}
                value={state.workflowDraft.volumeNumber}
                onChange={(event) =>
                  actions.setWorkflowDraft((current) => ({
                    ...current,
                    volumeNumber: Number(event.target.value || 1)
                  }))
                }
              />
            </Field>
            <Field label="章节号">
              <Input
                type="number"
                min={1}
                value={state.workflowDraft.chapterNumber}
                onChange={(event) =>
                  actions.setWorkflowDraft((current) => ({
                    ...current,
                    chapterNumber: Number(event.target.value || 1)
                  }))
                }
              />
            </Field>
            <Field label="写作粒度">
              <Select
                value={state.workflowDraft.scope}
                onChange={(event) =>
                  actions.setWorkflowDraft((current) => ({
                    ...current,
                    scope: event.target.value as typeof current.scope
                  }))
                }
              >
                <option value="chapter">按章</option>
                <option value="scene">按场景</option>
              </Select>
            </Field>
          </div>
          <Field label="工作流备注">
            <Textarea
              rows={3}
              value={state.workflowDraft.notes}
              onChange={(event) =>
                actions.setWorkflowDraft((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              placeholder="例如：这一章要压低信息量，重点放氛围和悬念。"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {dashboardActions.map((action) => (
              <SecondaryButton
                key={action}
                disabled={!state.selectedProject || Boolean(state.activeJob)}
                onClick={() => void actions.startWorkflow(action)}
                className={cn(
                  "justify-center",
                  action === "write-scene" || action === "write-chapter"
                    ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/16"
                    : undefined
                )}
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

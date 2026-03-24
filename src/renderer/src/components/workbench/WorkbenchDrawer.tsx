import type { WorkbenchHookResult } from "./types";
import { Drawer, Field, Input, PrimaryButton, StatusPill, Textarea } from "./ui";

export function WorkbenchDrawer({ state, actions }: WorkbenchHookResult) {
  return (
    <Drawer
      open={Boolean(state.drawer)}
      title={
        state.drawer?.kind === "artifact"
          ? state.drawer.document.displayTitle
          : state.drawer?.kind === "prompt"
            ? "Prompt Trace"
            : state.drawer?.kind === "context"
              ? "Context Trace"
              : ""
      }
      subtitle={
        state.drawer?.kind === "artifact"
          ? "这里是高级编辑入口，支持直接回写正式文档。"
          : state.drawer?.kind === "prompt"
            ? state.drawer.session.action
            : state.drawer?.kind === "context"
              ? "项目摘要与参考书使用情况"
              : undefined
      }
      onClose={actions.closeDrawer}
    >
      {state.drawer?.kind === "artifact" ? (
        <div className="space-y-4">
          {state.drawer.error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {state.drawer.error}
            </div>
          ) : null}
          <Field label="显示标题">
            <Input
              value={state.drawer.document.displayTitle}
              onChange={(event) =>
                actions.updateDrawerDocument((current) => ({
                  ...current,
                  displayTitle: event.target.value,
                  isDirty: true
                }))
              }
            />
          </Field>
          <Field label="原始内容">
            <Textarea
              rows={22}
              value={state.drawer.document.rawText}
              onChange={(event) =>
                actions.updateDrawerDocument((current) => ({
                  ...current,
                  rawText: event.target.value,
                  isDirty: true
                }))
              }
            />
          </Field>
          <div className="flex items-center justify-between">
            <StatusPill tone={state.drawer.document.isDirty ? "warning" : "success"}>
              {state.drawer.document.isDirty ? "有未保存改动" : "已同步"}
            </StatusPill>
            <PrimaryButton disabled={state.busy["save-artifact"]} onClick={() => void actions.saveDrawerDocument()}>
              {state.busy["save-artifact"] ? "保存中..." : "保存正式文档"}
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {state.drawer?.kind === "prompt" ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/6 bg-[#0d1018] p-4">
            <div className="mb-2 text-sm font-medium text-slate-200">System Prompt</div>
            <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
              {state.drawer.session.promptTrace?.systemPrompt ?? "尚未生成"}
            </pre>
          </div>
          <div className="rounded-3xl border border-white/6 bg-[#0d1018] p-4">
            <div className="mb-2 text-sm font-medium text-slate-200">User Prompt</div>
            <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
              {state.drawer.session.promptTrace?.userPrompt ?? "尚未生成"}
            </pre>
          </div>
        </div>
      ) : null}

      {state.drawer?.kind === "context" ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/6 bg-[#0d1018] p-4">
            <div className="mb-3 text-sm font-medium text-slate-200">项目摘要</div>
            <div className="space-y-2">
              {(state.drawer.session.promptTrace?.projectContextSummary ?? []).map((item: string) => (
                <div key={item} className="rounded-2xl border border-white/6 bg-black/10 px-3 py-2 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/6 bg-[#0d1018] p-4">
            <div className="mb-3 text-sm font-medium text-slate-200">本次实际带入的参考上下文</div>
            <div className="space-y-2">
              {(state.drawer.session.promptTrace?.referenceContext ?? []).map((item: string) => (
                <div key={item} className="rounded-2xl border border-white/6 bg-black/10 px-3 py-2 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/6 bg-[#0d1018] p-4">
            <div className="mb-3 text-sm font-medium text-slate-200">已选参考书</div>
            <div className="space-y-2">
              {state.drawer.selectedCorpora.map((corpus) => (
                <div key={corpus.corpusId} className="rounded-2xl border border-white/6 bg-black/10 px-3 py-2 text-sm text-slate-300">
                  {corpus.title}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

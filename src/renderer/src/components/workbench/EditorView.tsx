import { ChevronRight, PanelRightClose, PanelRightOpen, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArtifactEditorDocument } from "@shared/types";
import type { SaveStatus, WorkbenchHookResult } from "./types";
import { deriveChapterItems } from "./view-model";
import {
  EmptyState,
  Field,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  Textarea,
  cn
} from "./ui";

export function EditorView({ state, actions }: WorkbenchHookResult) {
  const { loadArtifactDocument, saveArtifactDocument, setWorkflowDraft, startWorkflow, regenerateCandidate, confirmCandidate, openPromptDrawer, openContextDrawer, createEmptyDraft } = actions;
  const chapters = useMemo(() => deriveChapterItems(state.selectedProject), [state.selectedProject]);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [selectedChapterKey, setSelectedChapterKey] = useState<string | null>(null);
  const [document, setDocument] = useState<ArtifactEditorDocument | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle", message: "等待编辑" });
  const baselineRef = useRef<{ chapterKey: string; title: string; content: string } | null>(null);

  useEffect(() => {
    if (!selectedChapterKey && chapters.length > 0) {
      setSelectedChapterKey(chapters[0].key);
    }
    if (selectedChapterKey && !chapters.some((chapter) => chapter.key === selectedChapterKey)) {
      setSelectedChapterKey(chapters[0]?.key ?? null);
    }
  }, [chapters, selectedChapterKey]);

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.key === selectedChapterKey) ?? chapters[0] ?? null,
    [chapters, selectedChapterKey]
  );

  useEffect(() => {
    if (!selectedChapter) {
      setDocument(null);
      setTitle("");
      setContent("");
      baselineRef.current = null;
      return;
    }

    setWorkflowDraft((current) => ({
      ...current,
      volumeNumber: selectedChapter.volumeNumber,
      chapterNumber: selectedChapter.chapterNumber
    }));

    if (!selectedChapter.draftId || !state.selectedProject) {
      setDocument(null);
      setTitle(selectedChapter.title);
      setContent(selectedChapter.outline?.summary ?? "");
      baselineRef.current = null;
      setSaveStatus({ state: "idle", message: "当前章节还没有正式草稿" });
      return;
    }

    let cancelled = false;
    void loadArtifactDocument({
        artifactType: "draft",
        artifactId: selectedChapter.draftId,
        projectId: state.selectedProject.manifest.projectId
      })
      .then((loaded) => {
        if (!loaded || cancelled) {
          return;
        }
        const nextTitle =
          ((loaded.structuredPayload as { title?: string } | undefined)?.title ?? loaded.displayTitle) || selectedChapter.title;
        setDocument(loaded);
        setTitle(nextTitle);
        setContent(loaded.rawText);
        baselineRef.current = {
          chapterKey: selectedChapter.key,
          title: nextTitle,
          content: loaded.rawText
        };
        setSaveStatus({ state: "saved", message: "已同步最新草稿" });
      });

    return () => {
      cancelled = true;
    };
  }, [loadArtifactDocument, selectedChapter, setWorkflowDraft, state.selectedProject]);

  useEffect(() => {
    if (!document || !selectedChapter || !baselineRef.current || baselineRef.current.chapterKey !== selectedChapter.key) {
      return;
    }

    if (title === baselineRef.current.title && content === baselineRef.current.content) {
      return;
    }

    setSaveStatus({ state: "saving", message: "保存中..." });
    const timeout = window.setTimeout(async () => {
      const structuredPayload = {
        ...((document.structuredPayload as Record<string, unknown> | undefined) ?? {}),
        title
      };
      const saved = await saveArtifactDocument({
        ...document,
        displayTitle: title,
        rawText: content,
        structuredPayload,
        isDirty: true
      });
      if (saved) {
        baselineRef.current = {
          chapterKey: selectedChapter.key,
          title,
          content
        };
        setDocument((current) =>
          current
            ? {
                ...current,
                displayTitle: title,
                rawText: content,
                structuredPayload,
                isDirty: false
              }
            : current
        );
        setSaveStatus({ state: "saved", message: "已自动保存" });
      } else {
        setSaveStatus({ state: "error", message: "保存失败，请检查设置或重试" });
      }
    }, Math.max(400, state.settingsDraft.editorPreferences.autoSaveMs));

    return () => window.clearTimeout(timeout);
  }, [content, document, saveArtifactDocument, selectedChapter, state.settingsDraft.editorPreferences.autoSaveMs, title]);

  const previewCandidate = state.activePreviewSession?.action === "write-chapter" || state.activePreviewSession?.action === "write-scene"
    ? state.selectedCandidate
    : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col border-r border-white/6 bg-[#141722]">
        <div className="border-b border-white/6 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            {state.selectedProject?.manifest.title ?? "未选择项目"}
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            {state.selectedProject ? `${state.selectedProject.drafts.length} 份草稿 · ${state.selectedProject.manifest.genre}` : "请先在控制台选择一个项目"}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {chapters.length === 0 ? (
            <EmptyState title="还没有章节" detail="先生成卷纲/章纲，或者确认一份章节草稿。" />
          ) : (
            chapters.map((chapter) => {
              const active = chapter.key === selectedChapter?.key;
              return (
                <button
                  key={chapter.key}
                  type="button"
                  onClick={() => setSelectedChapterKey(chapter.key)}
                  className={cn(
                    "mb-2 w-full rounded-2xl border p-3 text-left transition",
                    active
                      ? "border-cyan-400/30 bg-cyan-500/10"
                      : "border-transparent hover:border-white/8 hover:bg-white/5"
                  )}
                >
                  <div className={cn("text-sm font-medium", active ? "text-cyan-200" : "text-slate-200")}>
                    {chapter.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    第 {chapter.volumeNumber} 卷 · 第 {chapter.chapterNumber} 章 · {chapter.draftId ? "已有草稿" : "章纲回退"}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col bg-[#0f121b]">
        <div className="flex h-14 items-center justify-between border-b border-white/6 px-6">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>第 {selectedChapter?.volumeNumber ?? 1} 卷</span>
            <ChevronRight size={14} />
            <span className="text-slate-200">{selectedChapter?.title ?? "未选择章节"}</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill tone={saveStatus.state === "error" ? "danger" : saveStatus.state === "saving" ? "info" : "success"}>
              {saveStatus.message}
            </StatusPill>
            <GhostButton onClick={() => setAiPanelOpen((current) => !current)}>
              {aiPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </GhostButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          <div className="mx-auto w-full max-w-[min(100%,calc(100%-48px),var(--editor-max-width,920px))] px-8 py-16">
            {selectedChapter ? (
              document ? (
                <>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full border-none bg-transparent text-4xl font-semibold tracking-wide text-white outline-none"
                  />
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    className="mt-10 min-h-[60vh] w-full resize-none border-none bg-transparent text-lg leading-9 text-slate-200 outline-none"
                    style={{
                      fontSize: `${state.settingsDraft.editorPreferences.fontSize}px`,
                      lineHeight: state.settingsDraft.editorPreferences.lineHeight
                    }}
                  />
                </>
              ) : (
                <div className="rounded-[32px] border border-white/8 bg-[#141722] p-8">
                  <div className="text-3xl font-semibold text-white">{selectedChapter.title}</div>
                  <div className="mt-6 rounded-2xl border border-white/6 bg-[#0d1018] p-5">
                    <div className="text-sm font-medium text-slate-200">当前章纲摘要</div>
                    <p className="mt-3 text-base leading-8 text-slate-300">
                      {selectedChapter.outline?.summary ?? "当前章节还没有章纲，可先在控制台生成章纲。"}
                    </p>
                    {selectedChapter.outline ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">目标</div>
                          <div className="mt-2 text-sm text-slate-200">{selectedChapter.outline.goal}</div>
                        </div>
                        <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">冲突</div>
                          <div className="mt-2 text-sm text-slate-200">{selectedChapter.outline.conflict}</div>
                        </div>
                        <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">钩子</div>
                          <div className="mt-2 text-sm text-slate-200">{selectedChapter.outline.hook}</div>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-6 flex gap-3">
                      <PrimaryButton
                        onClick={() =>
                          void createEmptyDraft(
                            selectedChapter.volumeNumber,
                            selectedChapter.chapterNumber,
                            selectedChapter.title
                          )
                        }
                      >
                        开始手写
                      </PrimaryButton>
                      <SecondaryButton
                        onClick={() =>
                          void startWorkflow("write-chapter", {
                            volumeNumber: selectedChapter.volumeNumber,
                            chapterNumber: selectedChapter.chapterNumber,
                            scope: "chapter"
                          })
                        }
                      >
                        AI 生成本章
                      </SecondaryButton>
                      <SecondaryButton
                        onClick={() =>
                          void startWorkflow("write-scene", {
                            volumeNumber: selectedChapter.volumeNumber,
                            chapterNumber: selectedChapter.chapterNumber,
                            scope: "scene"
                          })
                        }
                      >
                        AI 先写场景
                      </SecondaryButton>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <EmptyState title="没有可编辑内容" detail="先创建项目并生成章纲或草稿。" />
            )}
          </div>
        </div>
      </section>

      {aiPanelOpen ? (
        <aside className="flex w-80 shrink-0 flex-col border-l border-white/6 bg-[#141722]">
          <div className="flex h-14 items-center justify-between border-b border-white/6 px-4">
            <div className="flex items-center gap-2 text-sm font-medium text-cyan-300">
              <Sparkles size={16} />
              <span>创作助手控制面板</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <Field label="工作流备注">
                <Textarea
                  rows={4}
                  value={state.workflowDraft.notes}
                  onChange={(event) =>
                    setWorkflowDraft((current) => ({
                      ...current,
                      notes: event.target.value
                    }))
                  }
                  placeholder="对这一章补充限制、风格或节奏要求"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <SecondaryButton
                  disabled={!selectedChapter}
                  onClick={() =>
                    selectedChapter &&
                    void startWorkflow("write-scene", {
                      volumeNumber: selectedChapter.volumeNumber,
                      chapterNumber: selectedChapter.chapterNumber,
                      scope: "scene"
                    })
                  }
                >
                  写场景
                </SecondaryButton>
                <PrimaryButton
                  disabled={!selectedChapter}
                  onClick={() =>
                    selectedChapter &&
                    void startWorkflow("write-chapter", {
                      volumeNumber: selectedChapter.volumeNumber,
                      chapterNumber: selectedChapter.chapterNumber,
                      scope: "chapter"
                    })
                  }
                >
                  写章节
                </PrimaryButton>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SecondaryButton disabled={!state.activePreviewSession} onClick={() => void regenerateCandidate()}>
                  重生成
                </SecondaryButton>
                <SecondaryButton disabled={!state.selectedCandidate} onClick={() => void confirmCandidate(state.selectedCandidate!.candidateId)}>
                  确认候选
                </SecondaryButton>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <GhostButton disabled={!state.activePreviewSession} onClick={openPromptDrawer}>
                  查看 Prompt
                </GhostButton>
                <GhostButton disabled={!state.activePreviewSession} onClick={openContextDrawer}>
                  查看 Context
                </GhostButton>
              </div>

              {previewCandidate ? (
                <div className="rounded-3xl border border-white/8 bg-[#0d1018] p-4">
                  <div className="text-sm font-medium text-slate-200">当前候选预览</div>
                  <p className="mt-2 line-clamp-6 text-sm leading-6 text-slate-400">{previewCandidate.renderedContent}</p>
                </div>
              ) : (
                <EmptyState title="这里不做自由聊天" detail="右侧只承载现有 workflow、候选确认和 prompt/context 查看能力。" />
              )}
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

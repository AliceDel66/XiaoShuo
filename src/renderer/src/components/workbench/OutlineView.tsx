import type { ArtifactEditorDocument, OutlinePacket } from "@shared/types";
import { ChevronDown, ChevronRight, Maximize2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WorkbenchHookResult } from "./types";
import { outlineArtifactRef, volumeOutlineTree } from "./view-model";
import {
  EmptyState,
  Field,
  GhostButton,
  PanelHeader,
  PrimaryButton,
  SecondaryButton,
  Textarea,
  cn
} from "./ui";

export function OutlineView({ state, actions }: WorkbenchHookResult) {
  const { loadArtifactDocument, saveArtifactDocument } = actions;
  const [mode, setMode] = useState<"board" | "timeline" | "characters">("board");
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(null);
  const [document, setDocument] = useState<ArtifactEditorDocument | null>(null);
  const [detail, setDetail] = useState<OutlinePacket | null>(null);
  const [saveMessage, setSaveMessage] = useState("选择节点后可编辑");
  const tree = useMemo(() => volumeOutlineTree(state.selectedProject), [state.selectedProject]);
  const [collapsedVolumes, setCollapsedVolumes] = useState<Set<string>>(new Set());

  function toggleVolume(volumeId: string) {
    setCollapsedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeId)) {
        next.delete(volumeId);
      } else {
        next.add(volumeId);
      }
      return next;
    });
  }

  useEffect(() => {
    const firstOutline = tree[0]?.chapters[0] ?? tree[0]?.volume ?? null;
    if (!selectedOutlineId && firstOutline) {
      setSelectedOutlineId(firstOutline.id);
    }
    if (selectedOutlineId && !state.selectedProject?.outlines.some((outline) => outline.id === selectedOutlineId)) {
      setSelectedOutlineId(firstOutline?.id ?? null);
    }
  }, [selectedOutlineId, state.selectedProject?.outlines, tree]);

  const selectedOutline =
    state.selectedProject?.outlines.find((outline) => outline.id === selectedOutlineId) ?? tree[0]?.chapters[0] ?? tree[0]?.volume ?? null;

  useEffect(() => {
    if (!selectedOutline || !state.selectedProject) {
      setDocument(null);
      setDetail(null);
      return;
    }

    const artifactType = selectedOutline.level === "volume" ? "volume-outline" : "chapter-outline";
    void loadArtifactDocument(outlineArtifactRef(state.selectedProject, artifactType)).then((loaded) => {
      if (!loaded) {
        return;
      }
      const payload = (loaded.structuredPayload as OutlinePacket[] | undefined) ?? [];
      setDocument(loaded);
      setDetail(payload.find((item) => item.id === selectedOutline.id) ?? selectedOutline);
      setSaveMessage("已载入当前节点详情");
    });
  }, [loadArtifactDocument, selectedOutline, state.selectedProject]);

  async function saveOutlineDetail() {
    if (!document || !detail || !state.selectedProject) {
      return;
    }
    const payload = ((document.structuredPayload as OutlinePacket[] | undefined) ?? []).map((item) =>
      item.id === detail.id ? detail : item
    );
    const saved = await saveArtifactDocument({
      ...document,
      structuredPayload: payload,
      rawText: document.rawText,
      isDirty: true
    });
    if (saved) {
      setDocument((current) => (current ? { ...current, structuredPayload: payload, isDirty: false } : current));
      setSaveMessage("已保存到章纲文档");
    } else {
      setSaveMessage("保存失败，请稍后重试");
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-[#0b0c13]">
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-white/6 bg-[#151722]">
        <div className="flex h-14 items-center justify-between border-b border-white/6 px-5">
          <h2 className="text-sm font-semibold tracking-[0.16em] text-slate-200">大纲结构</h2>
          <GhostButton onClick={() => state.selectedProject && void actions.openArtifact(outlineArtifactRef(state.selectedProject, "chapter-outline"))}>
            打开原文档
          </GhostButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {tree.length === 0 ? (
            <EmptyState title="还没有卷纲/章纲" detail="先在控制台生成卷纲与章纲，这里会自动映射成结构树和剧情看板。" />
          ) : (
            tree.map(({ volume, chapters }) => {
              const expanded = !collapsedVolumes.has(volume.id);
              return (
                <div key={volume.id} className="mb-4">
                  <button
                    type="button"
                    onClick={() => toggleVolume(volume.id)}
                    onDoubleClick={() => setSelectedOutlineId(volume.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition",
                      selectedOutlineId === volume.id ? "bg-cyan-500/10 text-cyan-200" : "text-slate-300 hover:bg-white/5"
                    )}
                  >
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="truncate">{volume.title}</span>
                  </button>
                  {expanded ? <div className="mt-1 space-y-1 pl-6">
                    {chapters.map((chapter) => (
                      <button
                        key={chapter.id}
                        type="button"
                        onClick={() => setSelectedOutlineId(chapter.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                          selectedOutlineId === chapter.id
                            ? "bg-[#22253a] text-cyan-200"
                            : "text-slate-400 hover:bg-white/5"
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70" />
                        <span className="truncate text-sm">{chapter.title}</span>
                      </button>
                    ))}
                  </div> : null}
                </div>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-[#0e1017]">
        <div className="flex h-14 items-center gap-8 border-b border-white/6 px-8">
          <div className="flex gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode("board")}
              className={cn(mode === "board" ? "text-cyan-300" : "text-slate-500 hover:text-slate-300")}
            >
              剧情看板
            </button>
            <button
              type="button"
              onClick={() => setMode("timeline")}
              className={cn(mode === "timeline" ? "text-cyan-300" : "text-slate-500 hover:text-slate-300")}
            >
              线性时间轴
            </button>
            <button
              type="button"
              onClick={() => setMode("characters")}
              className={cn(mode === "characters" ? "text-cyan-300" : "text-slate-500 hover:text-slate-300")}
            >
              角色轨迹
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <SecondaryButton onClick={() => void actions.startWorkflow("generate-chapter-outline")}>
              <Sparkles size={14} className="mr-1" />
              AI 推演剧情
            </SecondaryButton>
            <GhostButton>
              <Maximize2 size={16} />
            </GhostButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-8">
          {mode === "board" ? (
            <div className="flex min-w-max gap-6 pb-8">
              {tree.map(({ volume, chapters }) => (
                <div key={volume.id} className="w-[320px] shrink-0">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-slate-200">{volume.title}</h3>
                    <span className="text-xs text-slate-500">{chapters.length} 章</span>
                  </div>
                  <div className="space-y-3">
                    {chapters.map((chapter) => (
                      <button
                        key={chapter.id}
                        type="button"
                        onClick={() => setSelectedOutlineId(chapter.id)}
                        className="w-full rounded-3xl border border-white/8 bg-[#151722] p-5 text-left transition hover:border-white/16"
                      >
                        <div className="text-xs font-medium text-slate-500">
                          第 {chapter.chapterNumber} 章
                        </div>
                        <div className="mt-2 text-base font-semibold text-slate-100">{chapter.title}</div>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{chapter.summary}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {mode === "timeline" ? (
            <div className="space-y-4">
              {(state.selectedProject?.storyBible?.timeline ?? []).length === 0 ? (
                <EmptyState title="还没有时间线条目" detail="生成资料库后，故事时间线会自动映射到这里。" />
              ) : (
                state.selectedProject?.storyBible?.timeline.map((event) => (
                  <div key={event.id} className="rounded-3xl border border-white/8 bg-[#151722] p-5">
                    <div className="text-sm font-semibold text-white">{event.timeLabel}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{event.description}</p>
                    <div className="mt-3 text-xs text-slate-500">{event.chapterRef ?? "未绑定章节"}</div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {mode === "characters" ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {(state.selectedProject?.storyBible?.characters ?? []).length === 0 ? (
                <EmptyState title="还没有角色轨迹" detail="生成资料库后，角色卡与成长线会汇总在这里。" />
              ) : (
                state.selectedProject?.storyBible?.characters.map((character) => (
                  <div key={character.id} className="rounded-3xl border border-white/8 bg-[#151722] p-5">
                    <div className="text-base font-semibold text-white">{character.name}</div>
                    <div className="mt-1 text-sm text-cyan-300">{character.role}</div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{character.arc}</p>
                    <div className="mt-3 text-xs text-slate-500">{character.currentStatus}</div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </section>

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-white/6 bg-[#141722]">
        <PanelHeader
          eyebrow={detail?.level === "volume" ? "Volume" : "Chapter"}
          title={detail?.title ?? "详情编辑"}
          subtitle={saveMessage}
          action={
            detail && state.selectedProject ? (
              <GhostButton
                onClick={() =>
                  void actions.openArtifact(
                    outlineArtifactRef(state.selectedProject!, detail.level === "volume" ? "volume-outline" : "chapter-outline")
                  )
                }
              >
                原文档
              </GhostButton>
            ) : null
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {detail ? (
            <div className="space-y-4">
              <Field label="标题">
                <Textarea value={detail.title} rows={2} onChange={(event) => setDetail({ ...detail, title: event.target.value })} />
              </Field>
              <Field label="摘要">
                <Textarea value={detail.summary} rows={5} onChange={(event) => setDetail({ ...detail, summary: event.target.value })} />
              </Field>
              <Field label="目标">
                <Textarea value={detail.goal} rows={4} onChange={(event) => setDetail({ ...detail, goal: event.target.value })} />
              </Field>
              <Field label="冲突">
                <Textarea value={detail.conflict} rows={4} onChange={(event) => setDetail({ ...detail, conflict: event.target.value })} />
              </Field>
              <Field label="钩子">
                <Textarea value={detail.hook} rows={4} onChange={(event) => setDetail({ ...detail, hook: event.target.value })} />
              </Field>
            </div>
          ) : (
            <EmptyState title="选择一个卷纲或章纲节点" detail="右侧详情面板会直接回写到原有 volume-outline / chapter-outline 文档。" />
          )}
        </div>
        <div className="border-t border-white/6 p-5">
          <PrimaryButton disabled={!detail} className="w-full justify-center" onClick={() => void saveOutlineDetail()}>
            保存节点详情
          </PrimaryButton>
        </div>
      </aside>
    </div>
  );
}

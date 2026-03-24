import type {
  ArtifactEditorDocument,
  CharacterCard,
  FactionEntry,
  ForeshadowEntry,
  ItemEntry,
  StoryBible,
  TimelineEvent,
  WorldEntry
} from "@shared/types";
import { BookOpen, Cpu, Globe, Search, Sparkles, Tag, User, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DatabaseCategoryKey, DatabaseEntityRecord, WorkbenchHookResult } from "./types";
import { databaseOptions, databaseRecords, filterDatabaseRecords, storyBibleArtifactRef } from "./view-model";
import {
  EmptyState,
  Field,
  GhostButton,
  Input,
  PanelHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  Textarea,
  cn
} from "./ui";

export function DatabaseView({ state, actions }: WorkbenchHookResult) {
  const { loadArtifactDocument, saveArtifactDocument } = actions;
  const [category, setCategory] = useState<DatabaseCategoryKey>("all");
  const [search, setSearch] = useState("");
  const [document, setDocument] = useState<ArtifactEditorDocument | null>(null);
  const records = useMemo(() => databaseRecords(state.selectedProject?.storyBible ?? null), [state.selectedProject?.storyBible]);
  const filtered = useMemo(() => filterDatabaseRecords(records, category, search), [category, records, search]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DatabaseEntityRecord | null>(null);
  const [saveMessage, setSaveMessage] = useState("选中词条后可在右侧编辑");

  useEffect(() => {
    if (!selectedRecordId && filtered[0]) {
      setSelectedRecordId(filtered[0].id);
    }
    if (selectedRecordId && !filtered.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedRecordId]);

  useEffect(() => {
    setDetail(records.find((record) => record.id === selectedRecordId) ?? null);
  }, [records, selectedRecordId]);

  useEffect(() => {
    if (!state.selectedProject) {
      setDocument(null);
      return;
    }
    void loadArtifactDocument(storyBibleArtifactRef(state.selectedProject)).then((loaded) => {
      if (loaded) {
        setDocument(loaded);
      }
    });
  }, [loadArtifactDocument, state.selectedProject]);

  async function saveDetail() {
    if (!document || !detail || !state.selectedProject) {
      return;
    }
    const bible = ((document.structuredPayload as StoryBible | undefined) ?? state.selectedProject.storyBible)!;
    const nextBible = replaceStoryBibleEntry(bible, detail);
    const saved = await saveArtifactDocument({
      ...document,
      structuredPayload: nextBible,
      isDirty: true
    });
    if (saved) {
      setDocument((current) => (current ? { ...current, structuredPayload: nextBible, isDirty: false } : current));
      setSaveMessage("已保存到 story-bible 文档");
    } else {
      setSaveMessage("保存失败，请稍后重试");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#0f111a]">
      <div className="flex h-16 items-center justify-between border-b border-white/6 px-8">
        <div className="flex gap-2 overflow-x-auto">
          {databaseOptions(state.selectedProject?.storyBible ?? null).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setCategory(option.key)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm transition",
                category === option.key
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            <Input className="w-72 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="检索设定库..." />
          </div>
          <SecondaryButton disabled={!state.selectedProject} onClick={() => state.selectedProject && void actions.openArtifact(storyBibleArtifactRef(state.selectedProject))}>
            打开原文档
          </SecondaryButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto p-8">
          {filtered.length === 0 ? (
            <EmptyState title="没有匹配的词条" detail="可以切换分类、调整搜索词，或者先生成资料库。" />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {filtered.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedRecordId(record.id)}
                  className={cn(
                    "group flex h-64 flex-col rounded-3xl border p-5 text-left transition",
                    selectedRecordId === record.id
                      ? "border-cyan-400/30 bg-cyan-500/10"
                      : "border-white/8 bg-[#141722] hover:border-white/14"
                  )}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-[#0f111a]">
                      {iconForRecord(record)}
                    </div>
                    <StatusPill tone="info">{record.typeLabel}</StatusPill>
                  </div>
                  <h3 className="text-base font-semibold text-slate-100">{record.title}</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">{record.subtitle}</p>
                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-400">{record.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="flex w-96 shrink-0 flex-col border-l border-white/6 bg-[#141722]">
          <PanelHeader
            eyebrow="Detail"
            title={detail?.title ?? "设定扩写助手"}
            subtitle={detail ? saveMessage : "选定词条后可在这里编辑并保存回资料库"}
            action={
              detail ? (
                <GhostButton onClick={() => void actions.startWorkflow("generate-story-bible")}>
                  <Sparkles size={14} className="mr-1" />
                  AI 扩写
                </GhostButton>
              ) : null
            }
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {detail ? (
              <DetailEditor record={detail} onChange={setDetail} />
            ) : (
              <EmptyState title="点击左侧卡片查看详情" detail="这里不新增卡片级后端模型，仍统一回写 story-bible 文档。" />
            )}
          </div>
          <div className="border-t border-white/6 p-5">
            <PrimaryButton disabled={!detail} className="w-full justify-center" onClick={() => void saveDetail()}>
              保存当前设定
            </PrimaryButton>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetailEditor({
  record,
  onChange
}: {
  record: DatabaseEntityRecord;
  onChange: (record: DatabaseEntityRecord) => void;
}) {
  switch (record.category) {
    case "characters":
      return renderCharacterEditor(record, onChange);
    case "world":
      return renderWorldEditor(record, onChange);
    case "factions":
      return renderFactionEditor(record, onChange);
    case "items":
      return renderItemEditor(record, onChange);
    case "timeline":
      return renderTimelineEditor(record, onChange);
    case "foreshadows":
      return renderForeshadowEditor(record, onChange);
    default:
      return <EmptyState title="当前分类暂不支持编辑" detail="请选择角色、世界观、势力、物品、时间线或伏笔条目。" />;
  }
}

function renderCharacterEditor(record: DatabaseEntityRecord, onChange: (record: DatabaseEntityRecord) => void) {
  const payload = record.payload as CharacterCard;
  return (
    <div className="space-y-4">
      <Field label="姓名">
        <Input value={payload.name} onChange={(event) => onChange(updateRecord(record, { ...payload, name: event.target.value }, event.target.value, payload.role, payload.goal))} />
      </Field>
      <Field label="角色定位">
        <Input value={payload.role} onChange={(event) => onChange(updateRecord(record, { ...payload, role: event.target.value }, payload.name, event.target.value, payload.goal))} />
      </Field>
      <Field label="目标">
        <Textarea rows={3} value={payload.goal} onChange={(event) => onChange(updateRecord(record, { ...payload, goal: event.target.value }, payload.name, payload.role, event.target.value))} />
      </Field>
      <Field label="冲突">
        <Textarea rows={3} value={payload.conflict} onChange={(event) => onChange(updateRecord(record, { ...payload, conflict: event.target.value }, payload.name, payload.role, event.target.value))} />
      </Field>
      <Field label="成长线">
        <Textarea rows={3} value={payload.arc} onChange={(event) => onChange(updateRecord(record, { ...payload, arc: event.target.value }, payload.name, payload.role, event.target.value))} />
      </Field>
    </div>
  );
}

function renderWorldEditor(record: DatabaseEntityRecord, onChange: (record: DatabaseEntityRecord) => void) {
  const payload = record.payload as WorldEntry;
  return (
    <div className="space-y-4">
      <Field label="条目标题">
        <Input value={payload.title} onChange={(event) => onChange(updateRecord(record, { ...payload, title: event.target.value }, event.target.value, `${payload.rules.length} 条规则`, payload.summary))} />
      </Field>
      <Field label="世界观摘要">
        <Textarea rows={6} value={payload.summary} onChange={(event) => onChange(updateRecord(record, { ...payload, summary: event.target.value }, payload.title, `${payload.rules.length} 条规则`, event.target.value))} />
      </Field>
      <Field label="规则列表（每行一条）">
        <Textarea rows={6} value={payload.rules.join("\n")} onChange={(event) => onChange(updateRecord(record, { ...payload, rules: splitLines(event.target.value) }, payload.title, `${splitLines(event.target.value).length} 条规则`, payload.summary))} />
      </Field>
    </div>
  );
}

function renderFactionEditor(record: DatabaseEntityRecord, onChange: (record: DatabaseEntityRecord) => void) {
  const payload = record.payload as FactionEntry;
  return (
    <div className="space-y-4">
      <Field label="势力名称">
        <Input value={payload.name} onChange={(event) => onChange(updateRecord(record, { ...payload, name: event.target.value }, event.target.value, payload.relationshipToProtagonist, payload.agenda))} />
      </Field>
      <Field label="议程">
        <Textarea rows={4} value={payload.agenda} onChange={(event) => onChange(updateRecord(record, { ...payload, agenda: event.target.value }, payload.name, payload.relationshipToProtagonist, event.target.value))} />
      </Field>
      <Field label="与主角关系">
        <Input value={payload.relationshipToProtagonist} onChange={(event) => onChange(updateRecord(record, { ...payload, relationshipToProtagonist: event.target.value }, payload.name, event.target.value, payload.agenda))} />
      </Field>
      <Field label="资源（每行一条）">
        <Textarea rows={4} value={payload.resources.join("\n")} onChange={(event) => onChange(updateRecord(record, { ...payload, resources: splitLines(event.target.value) }, payload.name, payload.relationshipToProtagonist, payload.agenda))} />
      </Field>
    </div>
  );
}

function renderItemEditor(record: DatabaseEntityRecord, onChange: (record: DatabaseEntityRecord) => void) {
  const payload = record.payload as ItemEntry;
  return (
    <div className="space-y-4">
      <Field label="物品名">
        <Input value={payload.name} onChange={(event) => onChange(updateRecord(record, { ...payload, name: event.target.value }, event.target.value, payload.status, payload.purpose))} />
      </Field>
      <Field label="用途">
        <Textarea rows={4} value={payload.purpose} onChange={(event) => onChange(updateRecord(record, { ...payload, purpose: event.target.value }, payload.name, payload.status, event.target.value))} />
      </Field>
      <Field label="持有者">
        <Input value={payload.owner} onChange={(event) => onChange(updateRecord(record, { ...payload, owner: event.target.value }, payload.name, payload.status, payload.purpose))} />
      </Field>
      <Field label="状态">
        <Input value={payload.status} onChange={(event) => onChange(updateRecord(record, { ...payload, status: event.target.value }, payload.name, event.target.value, payload.purpose))} />
      </Field>
    </div>
  );
}

function renderTimelineEditor(record: DatabaseEntityRecord, onChange: (record: DatabaseEntityRecord) => void) {
  const payload = record.payload as TimelineEvent;
  return (
    <div className="space-y-4">
      <Field label="时间标记">
        <Input value={payload.timeLabel} onChange={(event) => onChange(updateRecord(record, { ...payload, timeLabel: event.target.value }, event.target.value, payload.chapterRef ?? "未绑定章节", payload.description))} />
      </Field>
      <Field label="事件描述">
        <Textarea rows={5} value={payload.description} onChange={(event) => onChange(updateRecord(record, { ...payload, description: event.target.value }, payload.timeLabel, payload.chapterRef ?? "未绑定章节", event.target.value))} />
      </Field>
      <Field label="章节引用">
        <Input value={payload.chapterRef ?? ""} onChange={(event) => onChange(updateRecord(record, { ...payload, chapterRef: event.target.value }, payload.timeLabel, event.target.value || "未绑定章节", payload.description))} />
      </Field>
      <Field label="关联角色（每行一位）">
        <Textarea rows={4} value={payload.relatedCharacters.join("\n")} onChange={(event) => onChange(updateRecord(record, { ...payload, relatedCharacters: splitLines(event.target.value) }, payload.timeLabel, payload.chapterRef ?? "未绑定章节", payload.description))} />
      </Field>
    </div>
  );
}

function renderForeshadowEditor(record: DatabaseEntityRecord, onChange: (record: DatabaseEntityRecord) => void) {
  const payload = record.payload as ForeshadowEntry;
  return (
    <div className="space-y-4">
      <Field label="伏笔">
        <Textarea rows={4} value={payload.clue} onChange={(event) => onChange(updateRecord(record, { ...payload, clue: event.target.value }, event.target.value, payload.status, payload.payoffPlan))} />
      </Field>
      <Field label="埋设位置">
        <Input value={payload.plantedAt} onChange={(event) => onChange(updateRecord(record, { ...payload, plantedAt: event.target.value }, payload.clue, payload.status, payload.payoffPlan))} />
      </Field>
      <Field label="回收计划">
        <Textarea rows={4} value={payload.payoffPlan} onChange={(event) => onChange(updateRecord(record, { ...payload, payoffPlan: event.target.value }, payload.clue, payload.status, event.target.value))} />
      </Field>
      <Field label="状态">
        <Input value={payload.status} onChange={(event) => onChange(updateRecord(record, { ...payload, status: event.target.value as ForeshadowEntry["status"] }, payload.clue, event.target.value, payload.payoffPlan))} />
      </Field>
    </div>
  );
}

function updateRecord(
  record: DatabaseEntityRecord,
  payload: unknown,
  title: string,
  subtitle: string,
  description: string
): DatabaseEntityRecord {
  return {
    ...record,
    payload,
    title,
    subtitle,
    description
  };
}

function replaceStoryBibleEntry(storyBible: StoryBible, record: DatabaseEntityRecord): StoryBible {
  switch (record.category) {
    case "characters":
      return {
        ...storyBible,
        characters: storyBible.characters.map((item) => (item.id === record.id ? (record.payload as CharacterCard) : item))
      };
    case "world":
      return {
        ...storyBible,
        world: storyBible.world.map((item, index) => (record.id === `world-${index}` ? (record.payload as WorldEntry) : item))
      };
    case "factions":
      return {
        ...storyBible,
        factions: storyBible.factions.map((item) => (item.id === record.id ? (record.payload as FactionEntry) : item))
      };
    case "items":
      return {
        ...storyBible,
        items: storyBible.items.map((item) => (item.id === record.id ? (record.payload as ItemEntry) : item))
      };
    case "timeline":
      return {
        ...storyBible,
        timeline: storyBible.timeline.map((item) => (item.id === record.id ? (record.payload as TimelineEvent) : item))
      };
    case "foreshadows":
      return {
        ...storyBible,
        foreshadows: storyBible.foreshadows.map((item) => (item.id === record.id ? (record.payload as ForeshadowEntry) : item))
      };
    default:
      return storyBible;
  }
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function iconForRecord(record: DatabaseEntityRecord) {
  switch (record.category) {
    case "characters":
      return <User size={18} className="text-blue-400" />;
    case "world":
      return <Globe size={18} className="text-emerald-400" />;
    case "factions":
      return <Users size={18} className="text-amber-400" />;
    case "items":
      return <Tag size={18} className="text-amber-300" />;
    case "timeline":
      return <BookOpen size={18} className="text-cyan-300" />;
    case "foreshadows":
      return <Cpu size={18} className="text-rose-300" />;
    default:
      return <Sparkles size={18} className="text-cyan-300" />;
  }
}

import { Plus, Clapperboard, Trash2, Archive, ArchiveRestore, ChevronLeft } from "lucide-react";
import { useState } from "react";
import type {
  AppApi,
  CreateDramaProjectInput,
  DramaCategory,
  DramaDashboardData,
  DramaProjectManifest
} from "@shared/types";
import { DRAMA_CATEGORY_TEMPLATES, createDramaProjectInputFromDefaults } from "@shared/defaults";

interface Props {
  api: AppApi;
  dashboardData: DramaDashboardData;
  onRefresh: () => void;
  onSelectProject: (projectId: string) => void;
}

export function DramaDashboardView({ api, dashboardData, onRefresh, onSelectProject }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateDramaProjectInput>(createDramaProjectInputFromDefaults());
  const [error, setError] = useState<string | null>(null);

  const projects = dashboardData.projects;
  const archived = dashboardData.archivedProjects;

  const handleCreate = async () => {
    if (!form.title.trim()) {
      setError("请输入项目名称");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const snapshot = await api.createDramaProject(form);
      setShowCreate(false);
      setForm(createDramaProjectInputFromDefaults());
      onRefresh();
      onSelectProject(snapshot.manifest.projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (projectId: string) => {
    await api.archiveDramaProject(projectId);
    onRefresh();
  };

  const handleRestore = async (projectId: string) => {
    await api.restoreDramaProject(projectId);
    onRefresh();
  };

  const handleDelete = async (projectId: string) => {
    await api.deleteDramaProject(projectId);
    onRefresh();
  };

  const applyCategoryTemplate = (category: DramaCategory) => {
    const tpl = DRAMA_CATEGORY_TEMPLATES.find((t) => t.category === category);
    if (tpl) {
      setForm((prev) => ({
        ...prev,
        category: tpl.category,
        totalEpisodes: tpl.defaultEpisodes,
        episodeDuration: tpl.defaultEpisodeDuration,
        premise: prev.premise || tpl.samplePremise
      }));
    }
  };

  if (showCreate) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button type="button" onClick={() => setShowCreate(false)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition">
          <ChevronLeft size={16} /> 返回项目列表
        </button>
        <h2 className="text-xl font-semibold text-orange-300">创建短剧项目</h2>

        {/* Category selector */}
        <div>
          <label className="mb-2 block text-sm text-slate-400">选择短剧类型</label>
          <div className="grid grid-cols-4 gap-2">
            {DRAMA_CATEGORY_TEMPLATES.map((tpl) => (
              <button
                key={tpl.category}
                type="button"
                onClick={() => applyCategoryTemplate(tpl.category)}
                className={[
                  "rounded-xl border p-3 text-left transition",
                  form.category === tpl.category
                    ? "border-orange-400/50 bg-orange-500/12 text-orange-300"
                    : "border-white/8 bg-white/4 text-slate-300 hover:bg-white/8"
                ].join(" ")}
              >
                <div className="text-sm font-medium">{tpl.label}</div>
                <div className="mt-1 text-xs text-slate-500 line-clamp-2">{tpl.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">项目名称 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="例：霸总的甜蜜危机"
              className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200 outline-none focus:border-orange-400/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">一句话构思</label>
            <textarea
              value={form.premise}
              onChange={(e) => setForm((p) => ({ ...p, premise: e.target.value }))}
              placeholder="用一句话描述你的短剧故事..."
              rows={3}
              className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200 outline-none focus:border-orange-400/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-slate-400">总集数</label>
              <input
                type="number"
                value={form.totalEpisodes}
                onChange={(e) => setForm((p) => ({ ...p, totalEpisodes: Number(e.target.value) || 60 }))}
                className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200 outline-none focus:border-orange-400/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">单集时长</label>
              <input
                type="text"
                value={form.episodeDuration}
                onChange={(e) => setForm((p) => ({ ...p, episodeDuration: e.target.value }))}
                className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200 outline-none focus:border-orange-400/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-slate-400">基调风格</label>
              <input
                type="text"
                value={form.toneStyle}
                onChange={(e) => setForm((p) => ({ ...p, toneStyle: e.target.value }))}
                placeholder="紧凑爽感 / 虐心催泪 / 轻松搞笑"
                className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200 outline-none focus:border-orange-400/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">目标受众</label>
              <input
                type="text"
                value={form.targetAudience}
                onChange={(e) => setForm((p) => ({ ...p, targetAudience: e.target.value }))}
                placeholder="18-35岁女性"
                className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200 outline-none focus:border-orange-400/50"
              />
            </div>
          </div>
        </div>

        {error && <div className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{error}</div>}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-medium text-slate-950 transition hover:bg-orange-400 disabled:bg-slate-700 disabled:text-slate-400"
          >
            <Clapperboard size={16} />
            {creating ? "创建中..." : "创建项目"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="rounded-xl border border-white/8 px-6 py-3 text-sm text-slate-400 transition hover:bg-white/5"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-orange-300">短剧项目</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-orange-400"
        >
          <Plus size={16} /> 新建短剧
        </button>
      </div>

      {projects.length === 0 && archived.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Clapperboard size={48} className="mb-4 text-slate-600" />
          <p className="text-lg">还没有短剧项目</p>
          <p className="mt-1 text-sm">点击「新建短剧」开始创作</p>
        </div>
      ) : null}

      {projects.length > 0 && (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard key={p.projectId} project={p} onOpen={onSelectProject} onArchive={handleArchive} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-500">已归档</h3>
          {archived.map((p) => (
            <ArchivedProjectCard key={p.projectId} project={p} onRestore={handleRestore} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onArchive
}: {
  project: DramaProjectManifest;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const tpl = DRAMA_CATEGORY_TEMPLATES.find((t) => t.category === project.category);
  return (
    <div
      className="group flex items-center justify-between rounded-2xl border border-white/6 bg-[#0f121a] p-4 transition hover:border-orange-400/20 cursor-pointer"
      onClick={() => onOpen(project.projectId)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium text-slate-200">{project.title}</span>
          <span className="rounded-lg bg-orange-500/15 px-2 py-0.5 text-xs text-orange-400">
            {tpl?.label ?? project.category}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
          <span>{project.totalEpisodes}集</span>
          <span>{project.episodeDuration}</span>
          <span>{project.currentStage}</span>
          <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
        </div>
        {project.premise && (
          <div className="mt-1 text-xs text-slate-500 line-clamp-1">{project.premise}</div>
        )}
      </div>
      <button
        type="button"
        title="归档"
        onClick={(e) => { e.stopPropagation(); void onArchive(project.projectId); }}
        className="ml-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 opacity-0 transition group-hover:opacity-100 hover:bg-white/5 hover:text-slate-300"
      >
        <Archive size={16} />
      </button>
    </div>
  );
}

function ArchivedProjectCard({
  project,
  onRestore,
  onDelete
}: {
  project: DramaProjectManifest;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-[#0f121a]/60 p-4 opacity-60">
      <div className="min-w-0 flex-1">
        <span className="text-sm text-slate-400">{project.title}</span>
        <span className="ml-2 text-xs text-slate-600">{project.category}</span>
      </div>
      <div className="flex gap-1">
        <button type="button" title="恢复" onClick={() => void onRestore(project.projectId)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-300">
          <ArchiveRestore size={16} />
        </button>
        <button type="button" title="删除" onClick={() => void onDelete(project.projectId)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-500/15 hover:text-rose-400">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

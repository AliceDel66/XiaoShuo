import { useState } from "react";
import { Save, Sparkles, ImageIcon, Loader2 } from "lucide-react";
import type {
  AppApi,
  DramaWorkbenchSettings,
  DramaWorkflowAction,
  ModelConnectionTestResult,
  ModelProfile
} from "@shared/types";
import {
  DEFAULT_DRAMA_WORKBENCH_SETTINGS,
  DRAMA_WORKFLOW_ACTION_LABELS,
  DRAMA_CATEGORY_TEMPLATES
} from "@shared/defaults";

interface Props {
  api: AppApi;
  settings: DramaWorkbenchSettings;
  onSaved: (settings: DramaWorkbenchSettings) => void;
}

export function DramaSettingsView({ api, settings, onSaved }: Props) {
  const [local, setLocal] = useState<DramaWorkbenchSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ModelConnectionTestResult | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.saveDramaSettings(local);
      onSaved(saved);
      setLocal(saved);
      setNotice("设置已保存");
      setTimeout(() => setNotice(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testDramaModelProfileConnection(local.modelProfile);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const updateModel = (patch: Partial<ModelProfile>) => {
    setLocal((prev) => ({
      ...prev,
      modelProfile: { ...prev.modelProfile, ...patch }
    }));
  };

  const updateImageModel = (patch: Partial<DramaWorkbenchSettings["imageModelProfile"]>) => {
    setLocal((prev) => ({
      ...prev,
      imageModelProfile: { ...prev.imageModelProfile, ...patch }
    }));
  };

  const actions = Object.keys(DRAMA_WORKFLOW_ACTION_LABELS) as DramaWorkflowAction[];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-orange-300">短剧工作台设置</h2>
        <div className="flex items-center gap-3">
          {notice && <span className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300">{notice}</span>}
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-orange-400 disabled:bg-slate-700 disabled:text-slate-400"
          >
            <Save size={16} />
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>

      {/* 独立的大语言模型配置 */}
      <section className="space-y-4 rounded-2xl border border-white/6 bg-[#0f121a] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-orange-400" />
            <h3 className="text-sm font-medium text-slate-200">短剧专属 LLM 模型</h3>
          </div>
          <button
            type="button"
            disabled={testing}
            onClick={() => void testConnection()}
            className="flex items-center gap-2 rounded-xl border border-orange-400/40 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : null}
            {testing ? "测试中..." : "测试连通性"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          此处配置的模型仅用于短剧模块（分镜、分集大纲、剧本等生成）。与小说模块的 AI 配置完全独立。留空则回退到小说模块的全局配置。
        </p>
        <div className="grid grid-cols-2 gap-4">
          <FieldInput
            label="API Base URL"
            value={local.modelProfile.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(v) => updateModel({ baseUrl: v })}
          />
          <FieldInput
            label="API Key"
            value={local.modelProfile.apiKey}
            placeholder="sk-..."
            type="password"
            onChange={(v) => updateModel({ apiKey: v })}
          />
          <FieldInput
            label="Planner 模型"
            value={local.modelProfile.plannerModel}
            placeholder="gpt-4o-mini / qwen-plus"
            onChange={(v) => updateModel({ plannerModel: v })}
          />
          <FieldInput
            label="Writer 模型"
            value={local.modelProfile.writerModel}
            placeholder="gpt-4o / qwen-max"
            onChange={(v) => updateModel({ writerModel: v })}
          />
          <FieldInput
            label="Auditor 模型"
            value={local.modelProfile.auditorModel}
            placeholder="gpt-4o-mini"
            onChange={(v) => updateModel({ auditorModel: v })}
          />
          <FieldInput
            label="Embedding 模型（可选）"
            value={local.modelProfile.embeddingModel ?? ""}
            placeholder="text-embedding-3-small"
            onChange={(v) => updateModel({ embeddingModel: v })}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldNumber
            label="Planner 温度"
            value={local.modelProfile.temperaturePolicy.planner}
            step={0.05}
            onChange={(v) =>
              updateModel({
                temperaturePolicy: { ...local.modelProfile.temperaturePolicy, planner: v }
              })
            }
          />
          <FieldNumber
            label="Writer 温度"
            value={local.modelProfile.temperaturePolicy.writer}
            step={0.05}
            onChange={(v) =>
              updateModel({
                temperaturePolicy: { ...local.modelProfile.temperaturePolicy, writer: v }
              })
            }
          />
          <FieldNumber
            label="Auditor 温度"
            value={local.modelProfile.temperaturePolicy.auditor}
            step={0.05}
            onChange={(v) =>
              updateModel({
                temperaturePolicy: { ...local.modelProfile.temperaturePolicy, auditor: v }
              })
            }
          />
        </div>

        {testResult ? (
          <div
            className={[
              "rounded-xl border px-3 py-2 text-xs",
              testResult.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            ].join(" ")}
          >
            <div className="mb-1 font-medium">{testResult.summary}</div>
            <ul className="space-y-0.5">
              {testResult.checks.map((check) => (
                <li key={`${check.target}-${check.label}`}>
                  · {check.label}：{check.status === "success" ? "✓" : check.status === "skipped" ? "—" : "✗"} {check.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* 文生图模型配置（人物三视图） */}
      <section className="space-y-4 rounded-2xl border border-white/6 bg-[#0f121a] p-5">
        <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-purple-400" />
          <h3 className="text-sm font-medium text-slate-200">人物三视图文生图模型</h3>
        </div>
        <p className="text-xs text-slate-500">
          用于生成角色正面/侧面/背面三视图。兼容 OpenAI images/generations 协议（如 DALL·E 3、通义万相、Stable Diffusion WebUI）。
        </p>
        <div className="grid grid-cols-2 gap-4">
          <FieldInput
            label="API URL"
            value={local.imageModelProfile.apiUrl}
            placeholder="https://api.openai.com/v1/images/generations"
            onChange={(v) => updateImageModel({ apiUrl: v })}
          />
          <FieldInput
            label="API Key"
            value={local.imageModelProfile.apiKey}
            placeholder="sk-..."
            type="password"
            onChange={(v) => updateImageModel({ apiKey: v })}
          />
          <FieldInput
            label="模型名"
            value={local.imageModelProfile.model}
            placeholder="dall-e-3 / wanx-v1"
            onChange={(v) => updateImageModel({ model: v })}
          />
          <FieldInput
            label="输出尺寸"
            value={local.imageModelProfile.size ?? "1024x1024"}
            placeholder="1024x1024"
            onChange={(v) => updateImageModel({ size: v })}
          />
        </div>
      </section>

      {/* Project defaults */}
      <section className="space-y-4 rounded-2xl border border-white/6 bg-[#0f121a] p-5">
        <h3 className="text-sm font-medium text-slate-300">项目默认值</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">默认类别</label>
            <select
              value={local.projectDefaults.category}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  projectDefaults: { ...prev.projectDefaults, category: e.target.value as DramaWorkbenchSettings["projectDefaults"]["category"] }
                }))
              }
              className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-slate-200 outline-none"
            >
              {DRAMA_CATEGORY_TEMPLATES.map((tpl) => (
                <option key={tpl.category} value={tpl.category} className="bg-[#141722]">
                  {tpl.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">默认集数</label>
            <input
              type="number"
              value={local.projectDefaults.totalEpisodes}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  projectDefaults: { ...prev.projectDefaults, totalEpisodes: Number(e.target.value) || 60 }
                }))
              }
              className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-slate-200 outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">默认单集时长</label>
            <input
              type="text"
              value={local.projectDefaults.episodeDuration}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  projectDefaults: { ...prev.projectDefaults, episodeDuration: e.target.value }
                }))
              }
              className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-slate-200 outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">默认基调风格</label>
            <input
              type="text"
              value={local.projectDefaults.toneStyle}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  projectDefaults: { ...prev.projectDefaults, toneStyle: e.target.value }
                }))
              }
              className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-slate-200 outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">默认目标受众</label>
            <input
              type="text"
              value={local.projectDefaults.targetAudience}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  projectDefaults: { ...prev.projectDefaults, targetAudience: e.target.value }
                }))
              }
              className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-slate-200 outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">默认项目目录</label>
            <input
              type="text"
              value={local.projectDefaults.defaultRootDirectory}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  projectDefaults: { ...prev.projectDefaults, defaultRootDirectory: e.target.value }
                }))
              }
              placeholder="留空使用默认路径"
              className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-slate-200 outline-none"
            />
          </div>
        </div>
      </section>

      {/* Prompt templates */}
      <section className="space-y-4 rounded-2xl border border-white/6 bg-[#0f121a] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-300">提示词模板</h3>
          <button
            type="button"
            onClick={() => setLocal((prev) => ({ ...prev, promptTemplates: DEFAULT_DRAMA_WORKBENCH_SETTINGS.promptTemplates }))}
            className="text-xs text-slate-500 hover:text-orange-400 transition"
          >
            恢复默认
          </button>
        </div>
        <div className="space-y-4">
          {actions.map((action) => (
            <div key={action} className="space-y-2 rounded-xl border border-white/4 bg-white/2 p-4">
              <div className="text-sm font-medium text-orange-300/80">{DRAMA_WORKFLOW_ACTION_LABELS[action]}</div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">系统提示词</label>
                <textarea
                  value={local.promptTemplates[action].systemTemplate}
                  onChange={(e) =>
                    setLocal((prev) => ({
                      ...prev,
                      promptTemplates: {
                        ...prev.promptTemplates,
                        [action]: { ...prev.promptTemplates[action], systemTemplate: e.target.value }
                      }
                    }))
                  }
                  rows={4}
                  className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-xs text-slate-300 outline-none resize-none font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">用户提示词</label>
                <textarea
                  value={local.promptTemplates[action].userTemplate}
                  onChange={(e) =>
                    setLocal((prev) => ({
                      ...prev,
                      promptTemplates: {
                        ...prev.promptTemplates,
                        [action]: { ...prev.promptTemplates[action], userTemplate: e.target.value }
                      }
                    }))
                  }
                  rows={2}
                  className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-xs text-slate-300 outline-none resize-none font-mono"
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-orange-400/50"
      />
    </label>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  step = 0.1
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const num = Number(e.target.value);
          if (Number.isFinite(num)) onChange(num);
        }}
        className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-orange-400/50"
      />
    </label>
  );
}


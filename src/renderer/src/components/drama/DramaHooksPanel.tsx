import { Plus, Trash2 } from "lucide-react";
import type { DramaHook } from "@shared/types";
import type { DramaState, DramaActions } from "./useDramaState";

const HOOK_TYPE_OPTIONS: Array<{ value: DramaHook["hookType"]; label: string }> = [
  { value: "cliffhanger", label: "悬念钩子" },
  { value: "reversal", label: "反转" },
  { value: "reveal", label: "揭秘" },
  { value: "foreshadow", label: "伏笔" }
];

const STATUS_OPTIONS: Array<{ value: DramaHook["status"]; label: string }> = [
  { value: "planted", label: "已埋设" },
  { value: "triggered", label: "已触发" },
  { value: "paid-off", label: "已揭晓" }
];

export function DramaHooksPanel({ state, actions }: { state: DramaState; actions: DramaActions }) {
  const { bible } = state;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">反转/钩子清单</h2>
          <p className="mt-1 text-sm text-slate-400">管理每集的反转点、悬念和伏笔</p>
        </div>
        <button
          type="button"
          onClick={actions.addHook}
          className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400"
        >
          <Plus size={16} /> 新增钩子
        </button>
      </div>

      {bible.hooks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 px-5 py-12 text-center">
          <p className="text-sm text-slate-400">暂无反转/钩子设定</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bible.hooks.map((hook, index) => (
            <div key={hook.id} className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-400">集数</span>
                      <input
                        type="number"
                        min={1}
                        value={hook.episodeNumber}
                        onChange={(e) => actions.updateHook(index, { ...hook, episodeNumber: Number(e.target.value) || 1 })}
                        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/60"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-400">钩子类型</span>
                      <select
                        value={hook.hookType}
                        onChange={(e) => actions.updateHook(index, { ...hook, hookType: e.target.value as DramaHook["hookType"] })}
                        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/60"
                      >
                        {HOOK_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-400">状态</span>
                      <select
                        value={hook.status}
                        onChange={(e) => actions.updateHook(index, { ...hook, status: e.target.value as DramaHook["status"] })}
                        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/60"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-400">揭晓集数</span>
                      <input
                        type="number"
                        min={1}
                        value={hook.payoffEpisode ?? ""}
                        onChange={(e) => actions.updateHook(index, { ...hook, payoffEpisode: Number(e.target.value) || undefined })}
                        placeholder="—"
                        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/60"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-400">描述</span>
                    <textarea
                      rows={2}
                      value={hook.description}
                      onChange={(e) => actions.updateHook(index, { ...hook, description: e.target.value })}
                      className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/60"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => actions.removeHook(index)}
                  className="ml-3 rounded-xl p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => void actions.saveBible()} className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-orange-400">
          保存
        </button>
      </div>
    </div>
  );
}

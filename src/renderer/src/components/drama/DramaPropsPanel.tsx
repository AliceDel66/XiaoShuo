import { Plus, Trash2 } from "lucide-react";
import type { DramaPropCostume } from "@shared/types";
import type { DramaState, DramaActions } from "./useDramaState";

const CATEGORY_OPTIONS: Array<{ value: DramaPropCostume["category"]; label: string }> = [
  { value: "prop", label: "道具" },
  { value: "costume", label: "服装" },
  { value: "makeup", label: "化妆" }
];

export function DramaPropsPanel({ state, actions }: { state: DramaState; actions: DramaActions }) {
  const { bible } = state;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">服化道设定</h2>
          <p className="mt-1 text-sm text-slate-400">管理道具、服装和化妆设定</p>
        </div>
        <button
          type="button"
          onClick={actions.addPropCostume}
          className="flex items-center gap-1.5 rounded-xl bg-purple-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-400"
        >
          <Plus size={16} /> 新增
        </button>
      </div>

      {bible.propsCostumes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 px-5 py-12 text-center">
          <p className="text-sm text-slate-400">暂无服化道设定</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bible.propsCostumes.map((pc, index) => (
            <div key={pc.id} className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-400">名称</span>
                      <input
                        value={pc.name}
                        onChange={(e) => actions.updatePropCostume(index, { ...pc, name: e.target.value })}
                        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400/60"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-400">类别</span>
                      <select
                        value={pc.category}
                        onChange={(e) => actions.updatePropCostume(index, { ...pc, category: e.target.value as DramaPropCostume["category"] })}
                        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400/60"
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-400">归属角色</span>
                      <input
                        value={pc.owner}
                        onChange={(e) => actions.updatePropCostume(index, { ...pc, owner: e.target.value })}
                        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400/60"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-400">描述</span>
                    <textarea
                      rows={2}
                      value={pc.description}
                      onChange={(e) => actions.updatePropCostume(index, { ...pc, description: e.target.value })}
                      className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400/60"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-400">出现场景（逗号分隔）</span>
                    <input
                      value={pc.scenes.join(", ")}
                      onChange={(e) => actions.updatePropCostume(index, { ...pc, scenes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-400/60"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => actions.removePropCostume(index)}
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

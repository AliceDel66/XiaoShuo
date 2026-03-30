import { Plus, Trash2 } from "lucide-react";
import type { DramaState, DramaActions } from "./useDramaState";

export function DramaLocationsPanel({ state, actions }: { state: DramaState; actions: DramaActions }) {
  const { bible } = state;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">场地规划</h2>
          <p className="mt-1 text-sm text-slate-400">管理短剧各场景的拍摄场地</p>
        </div>
        <button
          type="button"
          onClick={actions.addLocation}
          className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
        >
          <Plus size={16} /> 新增场地
        </button>
      </div>

      {bible.locations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 px-5 py-12 text-center">
          <p className="text-sm text-slate-400">暂无场地规划，点击上方按钮添加</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bible.locations.map((loc, index) => (
            <div key={loc.id} className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldInput
                      label="场地名称"
                      value={loc.name}
                      onChange={(v) => actions.updateLocation(index, { ...loc, name: v })}
                    />
                    <FieldInput
                      label="氛围"
                      value={loc.atmosphere}
                      onChange={(v) => actions.updateLocation(index, { ...loc, atmosphere: v })}
                    />
                  </div>
                  <FieldTextarea
                    label="场地描述"
                    value={loc.description}
                    onChange={(v) => actions.updateLocation(index, { ...loc, description: v })}
                  />
                  <FieldInput
                    label="灯光备注"
                    value={loc.lightingNotes}
                    onChange={(v) => actions.updateLocation(index, { ...loc, lightingNotes: v })}
                  />
                  <FieldInput
                    label="出现集数（逗号分隔）"
                    value={loc.episodes.join(", ")}
                    onChange={(v) => actions.updateLocation(index, { ...loc, episodes: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => actions.removeLocation(index)}
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

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60"
      />
    </label>
  );
}

function FieldTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60"
      />
    </label>
  );
}

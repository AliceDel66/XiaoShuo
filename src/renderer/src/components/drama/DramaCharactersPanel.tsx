import { Plus, Trash2, ImageIcon, Loader2 } from "lucide-react";
import type { DramaState, DramaActions } from "./useDramaState";

export function DramaCharactersPanel({ state, actions }: { state: DramaState; actions: DramaActions }) {
  const { bible, threeViewResults, generatingThreeView } = state;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">核心人物卡</h2>
          <p className="mt-1 text-sm text-slate-400">包含性格、口头禅、服装风格和三视图</p>
        </div>
        <button
          type="button"
          onClick={actions.addCharacter}
          className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-orange-400"
        >
          <Plus size={16} /> 新增角色
        </button>
      </div>

      {bible.characters.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 px-5 py-12 text-center">
          <p className="text-sm text-slate-400">暂无人物，点击上方按钮添加角色</p>
        </div>
      ) : (
        <div className="space-y-6">
          {bible.characters.map((char, index) => {
            const threeView = threeViewResults[char.id];
            const isGenerating = generatingThreeView === char.id;

            return (
              <div key={char.id} className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="角色名" value={char.name} onChange={(v) => actions.updateCharacter(index, { ...char, name: v })} />
                      <Field label="角色定位" value={char.role} onChange={(v) => actions.updateCharacter(index, { ...char, role: v })} />
                      <Field label="当前状态" value={char.currentStatus} onChange={(v) => actions.updateCharacter(index, { ...char, currentStatus: v })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="性格" value={char.personality} onChange={(v) => actions.updateCharacter(index, { ...char, personality: v })} />
                      <Field label="口头禅" value={char.catchphrase} onChange={(v) => actions.updateCharacter(index, { ...char, catchphrase: v })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="服装风格" value={char.costumeStyle} onChange={(v) => actions.updateCharacter(index, { ...char, costumeStyle: v })} />
                      <Field label="外貌描述" value={char.appearance} onChange={(v) => actions.updateCharacter(index, { ...char, appearance: v })} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="目标" value={char.goal} onChange={(v) => actions.updateCharacter(index, { ...char, goal: v })} />
                      <Field label="冲突" value={char.conflict} onChange={(v) => actions.updateCharacter(index, { ...char, conflict: v })} />
                      <Field label="弧线" value={char.arc} onChange={(v) => actions.updateCharacter(index, { ...char, arc: v })} />
                    </div>

                    {/* Three View Button & Gallery */}
                    <div className="mt-4 rounded-2xl border border-white/6 bg-[#0d1018] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-300">人物三视图</span>
                        <button
                          type="button"
                          disabled={isGenerating}
                          onClick={() => void actions.generateThreeView(char.id)}
                          className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/8 disabled:opacity-50"
                        >
                          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                          {isGenerating ? "生成中..." : "生成三视图"}
                        </button>
                      </div>

                      {threeView || char.threeViewImages ? (
                        <div className="mt-3 grid grid-cols-3 gap-3">
                          {["front", "side", "back"].map((view) => {
                            const src = (threeView?.images ?? char.threeViewImages)?.[view as keyof typeof char.threeViewImages & string];
                            return (
                              <div key={view} className="flex flex-col items-center">
                                <div className="flex h-32 w-full items-center justify-center rounded-2xl border border-white/6 bg-black/20">
                                  {src ? (
                                    <img src={src} alt={`${char.name} ${view}`} className="h-full w-full rounded-2xl object-contain" />
                                  ) : (
                                    <span className="text-xs text-slate-600">暂无图片</span>
                                  )}
                                </div>
                                <span className="mt-1 text-xs text-slate-500">
                                  {view === "front" ? "正面" : view === "side" ? "侧面" : "背面"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-600">点击「生成三视图」按钮，AI 将根据外貌描述自动生成正面、侧面、背面设计图</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => actions.removeCharacter(index)}
                    className="ml-3 rounded-xl p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-400/60"
      />
    </label>
  );
}

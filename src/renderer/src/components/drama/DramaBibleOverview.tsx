import { MapPin, Users, Shirt, Zap } from "lucide-react";
import type { DramaState, DramaActions } from "./useDramaState";

export function DramaBibleOverview({ state, actions }: { state: DramaState; actions: DramaActions }) {
  const { bible } = state;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">剧本资料库总览</h2>
        <p className="mt-1 text-sm text-slate-400">管理短剧的世界观、人物、场地和钩子设定</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<MapPin size={18} />} label="场地" count={bible.locations.length} color="cyan" onClick={() => actions.setActiveTab("locations")} />
        <StatCard icon={<Users size={18} />} label="人物" count={bible.characters.length} color="orange" onClick={() => actions.setActiveTab("characters")} />
        <StatCard icon={<Shirt size={18} />} label="服化道" count={bible.propsCostumes.length} color="purple" onClick={() => actions.setActiveTab("props")} />
        <StatCard icon={<Zap size={18} />} label="钩子/反转" count={bible.hooks.length} color="amber" onClick={() => actions.setActiveTab("hooks")} />
      </div>

      {/* World Setting */}
      <div className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5">
        <h3 className="mb-3 text-sm font-medium text-slate-200">世界观设定</h3>
        <textarea
          rows={4}
          value={bible.worldSetting}
          onChange={(e) => actions.updateBible((b) => ({ ...b, worldSetting: e.target.value }))}
          placeholder="描述短剧的核心世界观设定..."
          className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-orange-400/60"
        />
      </div>

      {/* Tone Style */}
      <div className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5">
        <h3 className="mb-3 text-sm font-medium text-slate-200">基调风格</h3>
        <textarea
          rows={3}
          value={bible.toneStyle}
          onChange={(e) => actions.updateBible((b) => ({ ...b, toneStyle: e.target.value }))}
          placeholder="短剧的整体风格、色调、节奏描述..."
          className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-orange-400/60"
        />
      </div>

      {/* Character preview */}
      {bible.characters.length > 0 ? (
        <div className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5">
          <h3 className="mb-3 text-sm font-medium text-slate-200">主要人物一览</h3>
          <div className="grid grid-cols-3 gap-3">
            {bible.characters.slice(0, 6).map((char) => (
              <div key={char.id} className="rounded-2xl border border-white/6 bg-[#0d1018] p-3">
                <div className="text-sm font-medium text-white">{char.name}</div>
                <div className="mt-1 text-xs text-slate-400">{char.role}</div>
                {char.catchphrase ? <div className="mt-2 text-xs italic text-orange-300/70">"{char.catchphrase}"</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void actions.saveBible()}
          className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-orange-400"
        >
          保存资料库
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, count, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: "cyan" | "orange" | "purple" | "amber";
  onClick: () => void;
}) {
  const colorMap = {
    cyan: "border-cyan-500/20 bg-cyan-500/8 text-cyan-300",
    orange: "border-orange-500/20 bg-orange-500/8 text-orange-300",
    purple: "border-purple-500/20 bg-purple-500/8 text-purple-300",
    amber: "border-amber-500/20 bg-amber-500/8 text-amber-300"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:opacity-80 ${colorMap[color]}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{count}</div>
    </button>
  );
}

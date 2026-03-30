import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import type { DramaState, DramaActions } from "./useDramaState";

const SHOT_SIZE_LABELS: Record<string, string> = {
  "extreme-wide": "远景",
  wide: "全景",
  medium: "中景",
  close: "近景",
  "extreme-close": "特写"
};

const MOVEMENT_LABELS: Record<string, string> = {
  push: "推",
  pull: "拉",
  pan: "摇",
  tilt: "移",
  track: "跟",
  crane: "升降",
  static: "固定",
  handheld: "手持"
};

export function DramaStoryboardPanel({ state, actions }: { state: DramaState; actions: DramaActions }) {
  const [episodeId, setEpisodeId] = useState("episode-1");
  const [scriptText, setScriptText] = useState("");

  const storyboard = state.storyboards[episodeId];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">AI 分镜表 / 镜头拆解</h2>
        <p className="mt-1 text-sm text-slate-400">将剧本文本自动拆解为拍摄可用的分镜表</p>
      </div>

      {/* Input area */}
      <div className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5">
        <div className="mb-3 grid grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5 col-span-1">
            <span className="text-xs font-medium text-slate-400">集数 ID</span>
            <input
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
              className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-400">剧本文本</span>
          <textarea
            rows={8}
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder="粘贴或输入一集的完整剧本文本..."
            className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60"
          />
        </label>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={state.generatingStoryboard || !scriptText.trim()}
            onClick={() => void actions.generateStoryboard(episodeId, scriptText)}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {state.generatingStoryboard ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            {state.generatingStoryboard ? "生成中..." : "生成分镜表"}
          </button>
        </div>
      </div>

      {/* Storyboard result */}
      {storyboard ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">
              分镜表 — {storyboard.episodeTitle} · 共 {storyboard.shots.length} 个镜头 · 总时长 {storyboard.totalDuration}
            </h3>
            <span className="text-xs text-slate-500">生成于 {storyboard.generatedAt}</span>
          </div>

          {/* Table view */}
          <div className="overflow-x-auto rounded-2xl border border-white/6">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/6 bg-[#0d1018]">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400">#</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400">景别</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400">运镜</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400">机位</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400">画面描述</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400">对白</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400">音效/BGM</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400">时长</th>
                </tr>
              </thead>
              <tbody>
                {storyboard.shots.map((shot) => (
                  <tr key={shot.shotId} className="border-b border-white/4 hover:bg-white/3">
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{shot.shotNumber}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block rounded-lg bg-cyan-500/12 px-2 py-0.5 text-xs text-cyan-300">
                        {SHOT_SIZE_LABELS[shot.shotSize] ?? shot.shotSize}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block rounded-lg bg-orange-500/12 px-2 py-0.5 text-xs text-orange-300">
                        {MOVEMENT_LABELS[shot.cameraMovement] ?? shot.cameraMovement}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-300">{shot.cameraAngle}</td>
                    <td className="max-w-[200px] px-3 py-2.5 text-xs text-slate-200">
                      {shot.description}
                    </td>
                    <td className="max-w-[150px] px-3 py-2.5 text-xs text-slate-300">{shot.dialogue || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {[shot.soundEffect, shot.bgm].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{shot.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 px-5 py-12 text-center">
          <p className="text-sm text-slate-400">输入剧本文本并点击「生成分镜表」</p>
          <p className="mt-2 text-xs text-slate-600">AI 将自动分析景别、运镜、机位、画面描述和音效提示</p>
        </div>
      )}
    </div>
  );
}

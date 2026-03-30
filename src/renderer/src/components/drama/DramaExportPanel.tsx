import { useState } from "react";
import { FolderArchive, FileText, ImageIcon, Loader2 } from "lucide-react";
import type { DramaState, DramaActions } from "./useDramaState";

export function DramaExportPanel({ state, actions }: { state: DramaState; actions: DramaActions }) {
  const [format, setFormat] = useState<"zip" | "pdf" | "png">("zip");
  const [includeThreeViews, setIncludeThreeViews] = useState(true);
  const [includeStoryboards, setIncludeStoryboards] = useState(true);
  const [includeBible, setIncludeBible] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const characterCount = state.bible.characters.length;
  const storyboardCount = Object.keys(state.storyboards).length;

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      await actions.exportAssets(format);
      setMessage({ ok: true, text: "导出完成！文件已保存。" });
    } catch {
      setMessage({ ok: false, text: "导出失败，请重试。" });
    } finally {
      setExporting(false);
    }
  };

  const FormatIcon = format === "zip" ? FolderArchive : format === "pdf" ? FileText : ImageIcon;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">资产打包导出</h2>
        <p className="mt-1 text-sm text-slate-400">将短剧圣经、角色三视图、分镜表等资产一键导出</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "角色", value: characterCount },
          { label: "分镜表", value: storyboardCount },
          { label: "三视图", value: Object.keys(state.threeViewResults).length }
        ].map(({ label, value }) => (
          <div key={label} className="rounded-3xl border border-white/6 bg-[#141722]/92 p-4 text-center">
            <p className="text-2xl font-bold text-orange-400">{value}</p>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Format picker */}
      <div className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5 space-y-4">
        <h3 className="text-sm font-medium text-white">导出格式</h3>
        <div className="flex gap-3">
          {(
            [
              { key: "zip", label: "ZIP 压缩包", desc: "包含全部资产", Icon: FolderArchive },
              { key: "pdf", label: "PDF 文档", desc: "纯文本设定导出", Icon: FileText },
              { key: "png", label: "PNG 图片", desc: "仅导出三视图图片", Icon: ImageIcon }
            ] as const
          ).map(({ key, label, desc, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormat(key)}
              className={`flex-1 rounded-2xl border p-4 text-left transition ${
                format === key
                  ? "border-orange-500/50 bg-orange-500/8"
                  : "border-white/8 bg-black/20 hover:border-white/12"
              }`}
            >
              <Icon size={20} className={format === key ? "text-orange-400" : "text-slate-500"} />
              <p className="mt-2 text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="rounded-3xl border border-white/6 bg-[#141722]/92 p-5 space-y-3">
        <h3 className="text-sm font-medium text-white">导出内容</h3>
        {[
          { label: "短剧圣经（角色 / 场景 / 道具 / 钩子）", checked: includeBible, set: setIncludeBible },
          { label: "角色三视图", checked: includeThreeViews, set: setIncludeThreeViews },
          { label: "分镜表", checked: includeStoryboards, set: setIncludeStoryboards }
        ].map(({ label, checked, set }) => (
          <label key={label} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => set(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 accent-orange-500"
            />
            <span className="text-sm text-slate-200">{label}</span>
          </label>
        ))}
      </div>

      {/* Export button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={exporting}
          onClick={() => void handleExport()}
          className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <FormatIcon size={16} />}
          {exporting ? "导出中..." : `导出为 ${format.toUpperCase()}`}
        </button>
        {message && (
          <span className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</span>
        )}
      </div>
    </div>
  );
}

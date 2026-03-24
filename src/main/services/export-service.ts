import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import JSZip from "jszip";
import type { ChapterDraft, ExportFormat, OutlinePacket, ProjectSnapshot } from "../../shared/types";
import { ensureDir, stripMarkdown, writeText } from "./helpers";

export class ExportService {
  async exportProject(snapshot: ProjectSnapshot, format: ExportFormat, exportDir: string): Promise<string> {
    await ensureDir(exportDir);
    switch (format) {
      case "markdown":
        return this.exportMarkdown(snapshot, exportDir);
      case "txt":
        return this.exportTxt(snapshot, exportDir);
      case "epub":
        return this.exportEpub(snapshot, exportDir);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportMarkdown(snapshot: ProjectSnapshot, exportDir: string): Promise<string> {
    const outputPath = join(exportDir, `${safeBookName(snapshot)}.md`);
    const markdown = composeBookMarkdown(snapshot);
    await writeText(outputPath, markdown);
    return outputPath;
  }

  private async exportTxt(snapshot: ProjectSnapshot, exportDir: string): Promise<string> {
    const outputPath = join(exportDir, `${safeBookName(snapshot)}.txt`);
    const text = stripMarkdown(composeBookMarkdown(snapshot));
    await writeText(outputPath, text);
    return outputPath;
  }

  private async exportEpub(snapshot: ProjectSnapshot, exportDir: string): Promise<string> {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.folder("META-INF")?.file(
      "container.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
    );

    const oebps = zip.folder("OEBPS");
    if (!oebps) {
      throw new Error("Failed to initialize EPUB structure");
    }

    const chapters = snapshot.drafts.sort((left, right) => left.chapterNumber - right.chapterNumber);
    const manifestItems = chapters
      .map(
        (_chapter, index) =>
          `<item id="chapter-${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`
      )
      .join("\n    ");
    const spineItems = chapters.map((_, index) => `<itemref idref="chapter-${index + 1}"/>`).join("\n    ");
    const navPoints = chapters
      .map(
        (chapter, index) => `    <navPoint id="navPoint-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="chapter-${index + 1}.xhtml"/>
    </navPoint>`
      )
      .join("\n");

    oebps.file(
      "content.opf",
      `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(snapshot.manifest.title)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="BookId">${escapeXml(snapshot.manifest.projectId)}</dc:identifier>
    <dc:creator>番茄作家助手</dc:creator>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`
    );

    oebps.file(
      "toc.ncx",
      `<?xml version="1.0" encoding="UTF-8"?>
<ncx version="2005-1" xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <head>
    <meta name="dtb:uid" content="${escapeXml(snapshot.manifest.projectId)}"/>
  </head>
  <docTitle><text>${escapeXml(snapshot.manifest.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`
    );

    chapters.forEach((chapter, index) => {
      oebps.file(`chapter-${index + 1}.xhtml`, toXhtml(snapshot.manifest.title, chapter));
    });

    const outputPath = join(exportDir, `${safeBookName(snapshot)}.epub`);
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    await writeFile(outputPath, buffer);
    return outputPath;
  }
}

function composeBookMarkdown(snapshot: ProjectSnapshot): string {
  const volumeOutlines = snapshot.outlines
    .filter((packet) => packet.level === "volume")
    .sort((left, right) => (left.volumeNumber ?? 0) - (right.volumeNumber ?? 0));
  const chapterOutlines = snapshot.outlines
    .filter((packet) => packet.level === "chapter")
    .sort((left, right) => (left.chapterNumber ?? 0) - (right.chapterNumber ?? 0));

  return [
    `# ${snapshot.manifest.title}`,
    "",
    `> 类型：${snapshot.manifest.genre}`,
    `> 目标字数：${snapshot.manifest.targetWords}`,
    `> 规划卷数：${snapshot.manifest.plannedVolumes}`,
    "",
    "## 立项",
    snapshot.premiseCard
      ? [
          "### 核心卖点",
          ...snapshot.premiseCard.coreSellingPoints.map((item) => `- ${item}`),
          "",
          "### 主线矛盾",
          snapshot.premiseCard.mainConflict
        ].join("\n")
      : "尚未生成立项。",
    "",
    "## 世界观与人物",
    snapshot.storyBible
      ? [
          "### 世界观",
          ...snapshot.storyBible.world.map((entry) => `- ${entry.title}：${entry.summary}`),
          "",
          "### 人物卡",
          ...snapshot.storyBible.characters.map((character) => `- ${character.name} / ${character.role}：${character.goal}`)
        ].join("\n")
      : "尚未生成资料库。",
    "",
    "## 卷纲",
    serializeOutlines(volumeOutlines),
    "",
    "## 章纲",
    serializeOutlines(chapterOutlines),
    "",
    "## 正文",
    ...snapshot.drafts
      .sort((left, right) => left.chapterNumber - right.chapterNumber)
      .flatMap((draft) => [`---`, "", draft.markdown, ""])
  ].join("\n");
}

function serializeOutlines(outlines: OutlinePacket[]): string {
  if (outlines.length === 0) {
    return "暂无大纲。";
  }

  return outlines
    .map(
      (outline) =>
        `- ${outline.title}\n  - 目标：${outline.goal}\n  - 冲突：${outline.conflict}\n  - 钩子：${outline.hook}`
    )
    .join("\n");
}

function safeBookName(snapshot: ProjectSnapshot): string {
  return basename(snapshot.manifest.rootPath);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toXhtml(bookTitle: string, chapter: ChapterDraft): string {
  const paragraphs = chapter.markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      if (line.startsWith("#")) {
        const level = Math.min(6, line.match(/^#+/)?.[0].length ?? 1);
        return `<h${level}>${escapeXml(line.replace(/^#+\s*/, ""))}</h${level}>`;
      }

      return `<p>${escapeXml(line)}</p>`;
    })
    .join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeXml(`${bookTitle} - ${chapter.title}`)}</title>
    <meta charset="UTF-8" />
  </head>
  <body>
    ${paragraphs}
  </body>
</html>`;
}

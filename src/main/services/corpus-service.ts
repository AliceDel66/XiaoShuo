import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import type {
  CorpusChunk,
  ImportCorpusInput,
  ReferenceAnalysisArtifacts,
  ReferenceCorpusManifest,
  SearchCorpusInput,
  SearchResult
} from "../../shared/types";
import { AiOrchestrator } from "./ai-orchestrator";
import { cosineSimilarity, excerpt, makeSnippet, termTokens, unique } from "./helpers";
import { LibraryDatabase } from "./library-database";

interface DecodedText {
  text: string;
  encoding: string;
}

interface SplitResult {
  chapterPattern: string;
  chunks: Array<{ title: string; content: string; position: number }>;
}

export class CorpusService {
  constructor(
    private readonly database: LibraryDatabase,
    private readonly aiOrchestrator: AiOrchestrator,
    private readonly builtinCorpusDir: string
  ) {}

  async seedBuiltinCorpora(): Promise<void> {
    try {
      const entries = await readdir(this.builtinCorpusDir, { withFileTypes: true });
      const textFiles = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt"));
      for (const entry of textFiles) {
        const corpusId = `builtin-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        if (this.database.hasCorpus(corpusId)) {
          continue;
        }

        await this.importCorpus({
          filePath: join(this.builtinCorpusDir, entry.name),
          sourceType: "builtin",
          licenseStatus: "sample"
        }, corpusId);
      }
    } catch {
      // Built-in corpora are optional during development.
    }
  }

  async importCorpus(input: ImportCorpusInput, forcedCorpusId?: string): Promise<ReferenceCorpusManifest> {
    const buffer = await readFile(input.filePath);
    const decoded = decodeText(buffer);
    const split = splitIntoChunks(decoded.text);
    const title = input.title ?? detectTitle(decoded.text, input.filePath);
    const corpusId = forcedCorpusId ?? `corpus-${nanoid(8)}`;

    const vectorTexts = split.chunks.map((chunk) => `${chunk.title}\n${excerpt(chunk.content, 800)}`);
    const vectors = await this.aiOrchestrator.embedTexts(vectorTexts);

    const chunks: CorpusChunk[] = split.chunks.map((chunk, index) => ({
      chunkId: `${corpusId}-chunk-${String(index + 1).padStart(4, "0")}`,
      corpusId,
      chapterTitle: chunk.title,
      content: chunk.content,
      position: chunk.position,
      vector: vectors?.[index]
    }));

    const manifest: ReferenceCorpusManifest = {
      corpusId,
      title,
      sourceType: input.sourceType,
      licenseStatus: input.licenseStatus,
      encoding: decoded.encoding,
      chapterPattern: split.chapterPattern,
      analysisArtifacts: analyzeCorpus(decoded.text, split),
      indexStatus: "ready",
      filePath: input.filePath,
      createdAt: new Date().toISOString()
    };

    this.database.upsertCorpus(manifest);
    this.database.replaceCorpusChunks(corpusId, chunks);
    return manifest;
  }

  search(input: SearchCorpusInput): SearchResult[] {
    const chunks = this.database.getCorpusChunks(input.corpusIds);
    const tokens = termTokens(input.query);
    const limit = input.limit ?? 8;

    if (tokens.length === 0) {
      return [];
    }

    const vectorSeed = chunks.find((chunk) => chunk.vector)?.vector;
    const queryVector = vectorSeed ? fakeQueryVector(tokens.join(" "), vectorSeed.length) : null;

    return chunks
      .map((chunk) => {
        const body = `${chunk.chapterTitle}\n${chunk.content}`.toLowerCase();
        const keywordScore = tokens.reduce((score, token) => {
          const count = body.split(token).length - 1;
          return score + count * (token.length > 2 ? 2 : 1);
        }, 0);
        const vectorScore = queryVector && chunk.vector ? cosineSimilarity(queryVector, chunk.vector) : 0;
        const score = keywordScore + vectorScore * 4;
        return {
          corpusId: chunk.corpusId,
          chunkId: chunk.chunkId,
          title: chunk.chapterTitle,
          snippet: makeSnippet(chunk.content, tokens[0]),
          score
        };
      })
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }
}

function decodeText(buffer: Buffer): DecodedText {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(buffer), encoding: "utf-8-bom" };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(buffer), encoding: "utf-16le" };
  }

  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(buffer), encoding: "utf-16be" };
  }

  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  const gbkText = new TextDecoder("gb18030").decode(buffer);
  const utf8Score = decodeScore(utf8Text);
  const gbkScore = decodeScore(gbkText);

  if (utf8Score <= gbkScore) {
    return { text: utf8Text, encoding: "utf-8" };
  }

  return { text: gbkText, encoding: "cp936" };
}

function decodeScore(text: string): number {
  const replacementCount = (text.match(/�/g) ?? []).length;
  const mojibakeCount = (text.match(/[鈥銆锟]/g) ?? []).length;
  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const suspiciousAscii = (text.match(/[ÃÂ¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿]/g) ?? []).length;

  let score = replacementCount * 20 + mojibakeCount * 8 + suspiciousAscii * 2;
  if (cjkCount === 0) {
    score += 200;
  }
  return score;
}

function splitIntoChunks(text: string): SplitResult {
  const lines = text.split(/\r?\n/);
  const nonEmpty = lines.map((line) => line.trim());
  const decoratedChapter = /^=+\s*第[0-9零一二三四五六七八九十百千万两〇]+\s*[章节部篇集][^=]{0,40}=+$/;
  const plainChapter = /^第\s*[0-9零一二三四五六七八九十百千万两〇]+\s*[章节部篇集][^\r\n]{0,40}$/;
  const volumeHeading = /^第\s*[0-9零一二三四五六七八九十百千万两〇]+\s*卷[^\r\n]{0,40}$/;

  const chapterHeadings = collectHeadings(nonEmpty, (line) => decoratedChapter.test(line) || plainChapter.test(line));
  const volumeHeadings = collectHeadings(nonEmpty, (line) => volumeHeading.test(line));
  const headings = chapterHeadings.length > 0 ? chapterHeadings : volumeHeadings;

  if (headings.length === 0) {
    return {
      chapterPattern: "single-file",
      chunks: [{ title: "全文", content: text.trim(), position: 1 }]
    };
  }

  const chunks: Array<{ title: string; content: string; position: number }> = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];
    const contentLines = lines.slice(heading.lineIndex + 1, nextHeading?.lineIndex ?? lines.length);
    const content = contentLines.join("\n").trim();
    if (!content) {
      continue;
    }

    chunks.push({
      title: heading.title,
      content,
      position: chunks.length + 1
    });
  }

  return {
    chapterPattern: chapterHeadings.length > 0 && volumeHeadings.length > 0
      ? "volume-then-chapter"
      : chapterHeadings.length > 0
        ? "chapter-heading"
        : "volume-heading",
    chunks: chunks.length > 0 ? chunks : [{ title: headings[0].title, content: text.trim(), position: 1 }]
  };
}

function collectHeadings(
  lines: string[],
  matcher: (line: string) => boolean
): Array<{ title: string; lineIndex: number }> {
  return lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => matcher(line) && line.length <= 60)
    .map(({ line, index }) => ({ title: line, lineIndex: index }));
}

function analyzeCorpus(text: string, split: SplitResult): ReferenceAnalysisArtifacts {
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const chapterCount = split.chunks.length;
  const averageParagraphLength = Math.round(
    paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0) / Math.max(1, paragraphs.length)
  );
  const dialogueParagraphs = paragraphs.filter((paragraph) => /^(“|"|'|‘|「|『)/.test(paragraph));
  const dialogueRatio = Number((dialogueParagraphs.length / Math.max(1, paragraphs.length)).toFixed(2));
  const emotionScore = (text.match(/[！？!?]/g) ?? []).length / Math.max(1, text.length);
  const suspenseTerms = ["秘密", "鬼", "异常", "黑暗", "真相", "失踪", "危机", "系统", "倒计时"];
  const suspenseHits = suspenseTerms.reduce((sum, term) => sum + ((text.match(new RegExp(term, "g")) ?? []).length), 0);
  const openingWindow = split.chunks[0]?.content.slice(0, 1600) ?? text.slice(0, 1600);

  return {
    structureProfile: {
      openingHook: classifyOpeningHook(openingWindow),
      escalationPattern: chapterCount > 50 ? "长线层层抬压" : chapterCount > 10 ? "中速递进升级" : "短线集中推进",
      suspenseDensity: suspenseHits / Math.max(1, chapterCount) > 6 ? "高" : suspenseHits / Math.max(1, chapterCount) > 2 ? "中" : "低",
      sceneCadence: averageParagraphLength > 45 ? "偏叙述推进" : "偏短句切场景",
      foreshadowCadence: suspenseHits > chapterCount * 3 ? "高频埋点" : "阶段性埋点",
      volumeDistribution: split.chapterPattern === "volume-then-chapter"
        ? "存在明确卷章结构"
        : chapterCount > 30
          ? "单层章节，适合按若干卷重组"
          : "偏短篇结构"
    },
    voiceProfile: {
      averageParagraphLength,
      dialogueRatio,
      emotionIntensity: emotionScore > 0.002 ? "高" : emotionScore > 0.001 ? "中" : "稳",
      narrationBias: dialogueRatio > 0.35 ? "对白驱动" : averageParagraphLength > 48 ? "叙述渗透" : "动作与信息并进",
      evidence: unique([
        split.chunks[0]?.title ?? "全文",
        excerpt(openingWindow.replace(/\s+/g, " "), 120),
        `章节数：${chapterCount}`
      ]).slice(0, 3)
    }
  };
}

function classifyOpeningHook(openingText: string): string {
  if (/(鬼|异常|恐怖|论坛|医院|失踪|敲门)/.test(openingText)) {
    return "悬疑异变钩子";
  }

  if (/(系统|穿越|装逼|打脸|仙女|修仙)/.test(openingText)) {
    return "高爽点系统钩子";
  }

  if (/(少年|雨|学校|超市|胡同|等人)/.test(openingText)) {
    return "人物切入式钩子";
  }

  return "局势切入式钩子";
}

function detectTitle(text: string, filePath: string): string {
  const firstMeaningfulLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstMeaningfulLine ? excerpt(firstMeaningfulLine, 36) : filePath.split(/[\\/]/).at(-1) ?? "未命名参考书";
}

function fakeQueryVector(text: string, dimension: number): number[] {
  const vector = new Array<number>(dimension).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    vector[index % dimension] += (code % 97) / 100;
  }
  return vector;
}

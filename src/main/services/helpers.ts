import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import YAML from "yaml";

export function nowIso(): string {
  return new Date().toISOString();
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeYaml(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, YAML.stringify(value), "utf8");
}

export async function readYaml<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = YAML.parse(raw) as T | null;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function parseYamlText<T>(text: string): T {
  return YAML.parse(text) as T;
}

export function stringifyYaml(value: unknown): string {
  return YAML.stringify(value);
}

export async function writeText(path: string, value: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, value, "utf8");
}

export async function readText(path: string, fallback = ""): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return fallback;
  }
}

export function sanitizeFileName(input: string): string {
  const cleaned = input.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return cleaned.length > 0 ? cleaned : "untitled";
}

export function slugifyId(input: string): string {
  return sanitizeFileName(input)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function summarizeList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^- /gm, "")
    .trim();
}

export function excerpt(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}...`;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function termTokens(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  if (/\s/.test(normalized)) {
    return unique(normalized.split(/\s+/).filter((term) => term.length > 0));
  }

  const tokens = [normalized];
  if (/[\u4e00-\u9fff]/.test(normalized) && normalized.length > 2) {
    for (let index = 0; index < normalized.length - 1; index += 1) {
      tokens.push(normalized.slice(index, index + 2));
    }
  }

  return unique(tokens);
}

export function makeSnippet(content: string, query: string): string {
  const normalizedContent = content.replace(/\s+/g, " ");
  const index = normalizedContent.toLowerCase().indexOf(query.trim().toLowerCase());
  if (index < 0) {
    return excerpt(normalizedContent, 120);
  }

  const start = Math.max(0, index - 40);
  const end = Math.min(normalizedContent.length, index + Math.max(40, query.length + 30));
  return normalizedContent.slice(start, end).trim();
}

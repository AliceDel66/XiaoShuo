import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkbenchService } from "../src/main/services/workbench-service";

const cp936SampleHex =
  "d2b9b5c4c3fcc3fbcaf50ab5dad2bbbeed20b3f5b3b10ab5da31d5c220cfebb5c8b5c4c8cb0ad6f7bdc7d7dfbdf8d3ead2b9a1a30ab5da32d5c220b5b9bcc6cab10acfdfcbf7c2e4cfc2a1a30a";

const utf8DecoratedHex =
  "e3808ae992a2e99ba8e59f8ee6898be5868ce3808b0a3d3d3de7acace4b880e7aba020e5a4b1e68ea7e79a84e699a8e4bc9a3d3d3d0ae794b5e6a2afe5819ce59ca8e58d81e4b889e5b182efbc8ce68980e69c89e4babae79a84e883b8e7898ce983bde58f98e4ba86e5908de5ad97e380820a3d3d3de7acace4ba8ce7aba020e99d99e9bb98e6a1a3e6a1883d3d3d0ae5a5b9e58f91e78eb0e887aae5b7b1e698a8e5a4a9e79a84e794b3e8afb7e8a1a8e69da5e887aae6988ee5a4a9e380820a";

describe("WorkbenchService", () => {
  let tempRoot = "";
  let service: WorkbenchService;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "fanqie-workbench-"));
    const dataDir = join(tempRoot, "data");
    const projectsDir = join(tempRoot, "projects");
    const builtinDir = join(tempRoot, "builtin");
    service = new WorkbenchService(dataDir, projectsDir, builtinDir);
    await service.init();
  });

  afterEach(async () => {
    service.dispose();
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("imports cp936 and utf-8 corpora with expected heading detection", async () => {
    const cp936Path = join(tempRoot, "夜的命名术样本.txt");
    await writeFile(cp936Path, Buffer.from(cp936SampleHex, "hex"));
    const cp936Corpus = await service.importCorpus({
      filePath: cp936Path,
      sourceType: "imported",
      licenseStatus: "user-provided"
    });

    expect(cp936Corpus.encoding).toBe("cp936");
    expect(cp936Corpus.chapterPattern).toBe("volume-then-chapter");

    const utf8Path = join(tempRoot, "钢雨城样本.txt");
    await writeFile(utf8Path, Buffer.from(utf8DecoratedHex, "hex"));
    const utf8Corpus = await service.importCorpus({
      filePath: utf8Path,
      sourceType: "imported",
      licenseStatus: "user-provided"
    });

    expect(utf8Corpus.encoding).toBe("utf-8");
    expect(utf8Corpus.chapterPattern).toBe("chapter-heading");

    const results = await service.searchCorpus({
      query: "倒计时",
      corpusIds: [cp936Corpus.corpusId],
      limit: 3
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("第2章");
  });

  it("blocks strict workflow steps until prerequisites exist", async () => {
    const project = await service.createProject({
      title: "灰烬时钟",
      premise: "主角每次使用倒计时能力都会丢失一段他人记忆中的身份。",
      genre: "悬疑成长",
      targetWords: 800000,
      plannedVolumes: 6,
      endingType: "阶段收束式开放结局",
      workflowMode: "strict"
    });

    const result = await service.executeWorkflow({
      projectId: project.manifest.projectId,
      action: "generate-story-bible"
    });

    expect(result.warnings).toEqual([
      expect.objectContaining({
        level: "blocking"
      })
    ]);

    const snapshot = await service.getProject(project.manifest.projectId);
    expect(snapshot.storyBible).toBeNull();
  });

  it("runs the end-to-end v1 flow and exports markdown, txt, and epub", async () => {
    const project = await service.createProject({
      title: "灰烬时钟",
      premise: "主角每次使用倒计时能力都会丢失一段他人记忆中的身份。",
      genre: "悬疑成长",
      targetWords: 1000000,
      plannedVolumes: 6,
      endingType: "开放式大结局",
      workflowMode: "strict"
    });

    const projectId = project.manifest.projectId;
    await service.executeWorkflow({ projectId, action: "generate-project-setup" });
    await service.executeWorkflow({ projectId, action: "generate-story-bible" });
    await service.executeWorkflow({ projectId, action: "generate-volume-outline" });
    await service.executeWorkflow({
      projectId,
      action: "generate-chapter-outline",
      volumeNumber: 1
    });
    await service.executeWorkflow({
      projectId,
      action: "write-chapter",
      volumeNumber: 1,
      chapterNumber: 1,
      scope: "chapter"
    });
    await service.executeWorkflow({
      projectId,
      action: "update-chapter-state",
      chapterNumber: 1
    });
    await service.executeWorkflow({ projectId, action: "run-audit" });

    const snapshot = await service.getProject(projectId);
    expect(snapshot.premiseCard?.coreSellingPoints.length).toBeGreaterThan(0);
    expect(snapshot.storyBible?.characters.length).toBeGreaterThan(0);
    expect(snapshot.outlines.filter((outline) => outline.level === "volume").length).toBe(6);
    expect(snapshot.outlines.filter((outline) => outline.level === "chapter").length).toBeGreaterThanOrEqual(3);
    expect(snapshot.drafts).toHaveLength(1);
    expect(snapshot.chapterStates).toHaveLength(1);
    expect(snapshot.audits.length).toBeGreaterThan(0);

    await access(join(snapshot.manifest.rootPath, "project.yaml"));
    await access(join(snapshot.manifest.rootPath, "00-立项", "premise-card.yaml"));
    await access(join(snapshot.manifest.rootPath, "01-资料库", "characters.yaml"));
    await access(join(snapshot.manifest.rootPath, "02-大纲", "volumes.yaml"));
    await access(join(snapshot.manifest.rootPath, "03-正文", "chapter-001.md"));
    await access(join(snapshot.manifest.rootPath, "04-状态", "chapter-001.yaml"));

    const markdownPath = await service.exportProject({ projectId, format: "markdown" });
    const txtPath = await service.exportProject({ projectId, format: "txt" });
    const epubPath = await service.exportProject({ projectId, format: "epub" });

    const markdown = await readFile(markdownPath, "utf8");
    const txt = await readFile(txtPath, "utf8");
    const epub = await readFile(epubPath);

    expect(markdown).toContain("# 灰烬时钟");
    expect(txt).toContain("灰烬时钟");
    expect(epub.subarray(0, 2).toString()).toBe("PK");
  });
  it("archives projects without deleting files and allows restoring them", async () => {
    const project = await service.createProject({
      title: "Archive Flow",
      premise: "A newsroom tracks a serialized novel through an editorial workbench.",
      genre: "Urban suspense",
      targetWords: 500000,
      plannedVolumes: 4,
      endingType: "Open ending",
      workflowMode: "strict"
    });

    const projectId = project.manifest.projectId;
    const projectRoot = project.manifest.rootPath;
    const manifestPath = join(projectRoot, "project.yaml");

    await access(projectRoot);
    await access(manifestPath);

    const archivedDashboard = await service.archiveProject(projectId);
    expect(archivedDashboard.projects.some((item) => item.projectId === projectId)).toBe(false);
    expect(archivedDashboard.archivedProjects.some((item) => item.projectId === projectId)).toBe(true);

    await access(projectRoot);
    await access(manifestPath);

    const archivedProject = await service.getProject(projectId);
    expect(archivedProject.manifest.archivedAt).toBeTruthy();

    const restoredDashboard = await service.restoreProject(projectId);
    expect(restoredDashboard.projects.some((item) => item.projectId === projectId)).toBe(true);
    expect(restoredDashboard.archivedProjects.some((item) => item.projectId === projectId)).toBe(false);

    const restoredProject = await service.getProject(projectId);
    expect(restoredProject.manifest.archivedAt).toBeNull();

    await access(projectRoot);
    await access(manifestPath);
  });
});

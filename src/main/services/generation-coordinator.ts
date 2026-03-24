import { EventEmitter } from "node:events";
import { nanoid } from "nanoid";
import type {
  GenerationEvent,
  GenerationJob,
  GenerationPhase,
  PreviewSession,
  ProjectSnapshot,
  ReferenceCorpusManifest,
  SearchResult,
  WorkflowExecutionInput
} from "../../shared/types";
import type { AssembledMemoryContext } from "../../shared/memory-types";
import { nowIso } from "./helpers";
import { PreviewSessionService } from "./preview-session-service";
import { WorkflowService } from "./workflow-service";

interface GenerationContext {
  snapshot: ProjectSnapshot;
  referenceHints: ReferenceCorpusManifest[];
  referenceMatches: SearchResult[];
  memoryContext?: AssembledMemoryContext | null;
}

const orderedPhases: GenerationPhase[] = [
  "queued",
  "preflight",
  "retrieval",
  "prompt-ready",
  "model-running",
  "parsing",
  "candidate-ready",
  "saving",
  "completed"
];

export class GenerationCoordinator {
  private readonly emitter = new EventEmitter();

  private activeJob: GenerationJob | null = null;

  private activeSessionId: string | null = null;

  /** Tracks the current running job so stale fire-and-forget tasks can detect cancellation. */
  private activeJobId: string | null = null;

  constructor(
    private readonly workflowService: WorkflowService,
    private readonly previewSessionService: PreviewSessionService,
    private readonly loadGenerationContext: (input: WorkflowExecutionInput) => Promise<GenerationContext>
  ) {}

  onEvent(listener: (event: GenerationEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => {
      this.emitter.off("event", listener);
    };
  }

  getActiveJob(): GenerationJob | null {
    return this.activeJob;
  }

  async getActivePreviewSession(): Promise<PreviewSession | null> {
    if (!this.activeSessionId) {
      return null;
    }

    try {
      return await this.previewSessionService.getSession(this.activeSessionId);
    } catch {
      return null;
    }
  }

  async startGeneration(
    input: WorkflowExecutionInput,
    existingSessionId?: string
  ): Promise<{ jobId: string; sessionId: string }> {
    if (this.activeJob?.status === "running") {
      // Cancel the stale job instead of hard-throwing.
      // This allows regeneration to proceed while a slow job is still in-flight.
      console.warn(`[GenerationCoordinator] 取消正在运行的旧任务 ${this.activeJob.jobId}，启动新任务。`);
      await this.failJob(this.activeJob, "已被新的生成任务取代。");
    }

    let context: GenerationContext;
    try {
      context = await this.loadGenerationContext(input);
    } catch (error) {
      // If context loading fails after we already cancelled the old job, make sure
      // the session gets a proper error so the UI doesn't end up in a blank state.
      const message = error instanceof Error ? error.message : String(error);
      if (existingSessionId) {
        const failedSession = await this.previewSessionService.updateSession(existingSessionId, (current) => ({
          ...current,
          status: "failed",
          errorMessage: `上下文加载失败：${message}`
        }));
        this.emitSession(failedSession);
      }
      throw error;
    }

    const prepared = this.workflowService.prepareGenerationTarget(context.snapshot, input);
    const sessionId = existingSessionId ?? `session-${nanoid(8)}`;

    const session = existingSessionId
      ? await this.previewSessionService.updateSession(existingSessionId, (current) => ({
          ...current,
          request: input,
          status: "running",
          warnings: prepared.warnings,
          errorMessage: undefined
        }))
      : await this.previewSessionService.createSession({
          sessionId,
          projectId: input.projectId,
          action: input.action,
          artifactRef: prepared.artifactRef,
          request: input,
          status: "running",
          warnings: prepared.warnings
        });

    this.activeSessionId = session.sessionId;
    this.emitSession(session);

    const job: GenerationJob = {
      jobId: `job-${nanoid(8)}`,
      sessionId: session.sessionId,
      projectId: input.projectId,
      action: input.action,
      status: "running",
      progress: phaseProgress("queued", "任务已加入生成队列。"),
      startedAt: nowIso(),
      targetArtifact: prepared.artifactRef
    };

    this.activeJob = job;
    this.activeJobId = job.jobId;
    this.emitJob(job);
    void this.runJob(job, session.sessionId, input, context);

    return {
      jobId: job.jobId,
      sessionId: session.sessionId
    };
  }

  /** Returns true if the given job has been superseded by a newer one. */
  private isStale(jobId: string): boolean {
    return this.activeJobId !== jobId;
  }

  private async runJob(
    job: GenerationJob,
    sessionId: string,
    input: WorkflowExecutionInput,
    context: GenerationContext
  ): Promise<void> {
    try {
      await this.pushTrace(sessionId, "queued", "已创建生成会话", `${input.action} 已排队。`);

      if (this.isStale(job.jobId)) return;

      const prepared = this.workflowService.prepareGenerationTarget(context.snapshot, input);
      await this.updateJob(job, "preflight", prepared.blocked ? "前置校验失败。" : "前置校验通过。");
      await this.pushTrace(
        sessionId,
        "preflight",
        prepared.blocked ? "前置校验失败" : "前置校验通过",
        prepared.warnings.length > 0
          ? prepared.warnings.map((warning) => `${warning.level}: ${warning.message}`).join("\n")
          : "没有阻塞项。"
      );

      if (prepared.blocked) {
        const failedSession = await this.previewSessionService.updateSession(sessionId, (session) => ({
          ...session,
          status: "failed",
          warnings: prepared.warnings,
          errorMessage: prepared.warnings.map((warning) => warning.message).join(" / ")
        }));
        this.emitSession(failedSession);
        await this.failJob(job, failedSession.errorMessage ?? "前置校验失败。");
        return;
      }

      if (this.isStale(job.jobId)) return;

      await this.updateJob(job, "retrieval", "正在整理项目上下文与参考素材。");
      await this.pushTrace(
        sessionId,
        "retrieval",
        "已整理参考上下文",
        `参考书 ${context.referenceHints.length} 本，命中素材 ${context.referenceMatches.length} 条。`
      );

      if (this.isStale(job.jobId)) return;

      const promptTrace = this.workflowService.buildPromptTrace(
        context.snapshot,
        input,
        context.referenceHints,
        context.referenceMatches,
        prepared,
        context.memoryContext ?? null
      );
      const promptReadySession = await this.previewSessionService.updateSession(sessionId, (session) => ({
        ...session,
        promptTrace
      }));
      this.emitSession(promptReadySession);
      await this.updateJob(job, "prompt-ready", "提示词与上下文已就绪。");
      await this.pushTrace(
        sessionId,
        "prompt-ready",
        "已构建提示词",
        `system prompt ${promptTrace.systemPrompt.length} 字，user prompt ${promptTrace.userPrompt.length} 字。`
      );

      if (this.isStale(job.jobId)) return;

      await this.updateJob(job, "model-running", "正在调用模型生成候选内容。");
      const generation = await this.workflowService.generateCandidate(
        context.snapshot,
        input,
        context.referenceHints,
        context.referenceMatches,
        prepared,
        promptReadySession.candidates.length + 1
      );

      if (this.isStale(job.jobId)) return;

      await this.pushTrace(
        sessionId,
        "model-running",
        generation.source === "model" ? "模型生成完成" : "⚠ 使用本地回退生成",
        generation.source === "model"
          ? "已收到模型响应。"
          : `未配置模型或调用失败，已切换本地模板。原因：${generation.candidate.source === "fallback" ? "fallback" : "unknown"}`
      );

      await this.updateJob(job, "parsing", "正在解析候选内容。");
      await this.pushTrace(
        sessionId,
        "parsing",
        "候选内容解析成功",
        `生成 ${generation.candidate.displayTitle}（来源：${generation.source}）。`
      );

      const nextCandidate = {
        ...generation.candidate,
        sessionId,
        source: generation.source
      };
      const candidateReadySession = await this.previewSessionService.updateSession(sessionId, (session) => ({
        ...session,
        status: "candidate-ready",
        selectedCandidateId: nextCandidate.candidateId,
        candidates: [...session.candidates, nextCandidate],
        promptTrace: generation.promptTrace,
        errorMessage: undefined
      }));
      this.emitSession(candidateReadySession);

      await this.updateJob(job, "candidate-ready", "候选版本已生成，可预览、重生成或保存。");
      await this.pushTrace(sessionId, "candidate-ready", "候选版本已就绪", nextCandidate.displayTitle);

      // Only clear activeJob if this job is still the active one (not superseded).
      if (!this.isStale(job.jobId)) {
        const completedJob: GenerationJob = {
          ...job,
          status: "completed",
          progress: phaseProgress("completed", "本次生成已完成，等待用户确认保存。"),
          finishedAt: nowIso()
        };
        this.activeJob = null;
        this.activeJobId = null;
        this.emitJob(completedJob);
        this.emitter.emit("event", { type: "job-cleared" } satisfies GenerationEvent);
      }
    } catch (error) {
      // If this job has been superseded, swallow the error silently.
      if (this.isStale(job.jobId)) return;
      const message = error instanceof Error ? error.message : String(error);
      const failedSession = await this.previewSessionService.updateSession(sessionId, (session) => ({
        ...session,
        status: "failed",
        errorMessage: message
      }));
      this.emitSession(failedSession);
      await this.failJob(job, message);
    }
  }

  private async updateJob(job: GenerationJob, phase: GenerationPhase, message: string): Promise<void> {
    const nextJob: GenerationJob = {
      ...job,
      progress: phaseProgress(phase, message)
    };
    this.activeJob = nextJob;
    this.emitJob(nextJob);
  }

  private async failJob(job: GenerationJob, message: string): Promise<void> {
    const failedJob: GenerationJob = {
      ...job,
      status: "failed",
      progress: phaseProgress("failed", message),
      errorMessage: message,
      finishedAt: nowIso()
    };
    if (this.activeJobId === job.jobId) {
      this.activeJob = null;
      this.activeJobId = null;
    }
    this.emitJob(failedJob);
    this.emitter.emit("event", { type: "job-cleared" } satisfies GenerationEvent);
  }

  private async pushTrace(sessionId: string, phase: GenerationPhase, title: string, detail: string): Promise<void> {
    const session = await this.previewSessionService.updateSession(sessionId, (current) => ({
      ...current,
      trace: [
        ...current.trace,
        {
          phase,
          title,
          detail,
          timestamp: nowIso(),
          level: phase === "failed" ? "error" : "info"
        }
      ]
    }));
    this.emitSession(session);
  }

  private emitJob(job: GenerationJob): void {
    this.emitter.emit("event", { type: "job-updated", job } satisfies GenerationEvent);
  }

  private emitSession(session: PreviewSession): void {
    this.emitter.emit("event", { type: "session-updated", session } satisfies GenerationEvent);
  }
}

function phaseProgress(phase: GenerationPhase, message: string) {
  const index = orderedPhases.indexOf(phase);
  const percent = index < 0 ? 0 : Math.round((index / (orderedPhases.length - 1)) * 100);
  return {
    phase,
    percent,
    message
  };
}

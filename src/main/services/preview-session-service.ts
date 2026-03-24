import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { PreviewCandidate, PreviewSession } from "../../shared/types";
import { ensureDir, nowIso, readYaml, writeYaml } from "./helpers";

export class PreviewSessionService {
  constructor(private readonly sessionsRoot: string) {}

  async init(): Promise<void> {
    await ensureDir(this.sessionsRoot);
  }

  async createSession(
    session: Omit<PreviewSession, "createdAt" | "updatedAt" | "candidates" | "selectedCandidateId" | "trace" | "promptTrace"> & {
      candidates?: PreviewCandidate[];
    }
  ): Promise<PreviewSession> {
    const now = nowIso();
    const nextSession: PreviewSession = {
      ...session,
      candidates: session.candidates ?? [],
      selectedCandidateId: null,
      trace: [],
      promptTrace: null,
      createdAt: now,
      updatedAt: now
    };
    await this.saveSession(nextSession);
    return nextSession;
  }

  async getSession(sessionId: string): Promise<PreviewSession> {
    const session = await readYaml<PreviewSession | null>(this.sessionFile(sessionId), null);
    if (!session) {
      throw new Error(`Preview session not found: ${sessionId}`);
    }
    return session;
  }

  async saveSession(session: PreviewSession): Promise<PreviewSession> {
    const nextSession: PreviewSession = {
      ...session,
      updatedAt: nowIso()
    };
    await ensureDir(this.sessionDir(session.sessionId));
    await writeYaml(this.sessionFile(session.sessionId), nextSession);
    return nextSession;
  }

  async updateSession(
    sessionId: string,
    updater: (session: PreviewSession) => PreviewSession | Promise<PreviewSession>
  ): Promise<PreviewSession> {
    const session = await this.getSession(sessionId);
    const updated = await updater(session);
    return this.saveSession(updated);
  }

  async discardSession(sessionId: string): Promise<void> {
    await rm(this.sessionDir(sessionId), { recursive: true, force: true });
  }

  private sessionDir(sessionId: string): string {
    return join(this.sessionsRoot, sessionId);
  }

  private sessionFile(sessionId: string): string {
    return join(this.sessionDir(sessionId), "session.yaml");
  }
}

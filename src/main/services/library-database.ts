import { DatabaseSync } from "node:sqlite";
import type { CorpusChunk, DramaProjectManifest, ProjectManifest, ReferenceCorpusManifest } from "../../shared/types";

export class LibraryDatabase {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        project_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        root_path TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        manifest_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS corpora (
        corpus_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        manifest_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS corpus_chunks (
        chunk_id TEXT PRIMARY KEY,
        corpus_id TEXT NOT NULL,
        chapter_title TEXT NOT NULL,
        content TEXT NOT NULL,
        position INTEGER NOT NULL,
        vector_json TEXT,
        FOREIGN KEY (corpus_id) REFERENCES corpora(corpus_id)
      );

      CREATE TABLE IF NOT EXISTS drama_projects (
        project_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        root_path TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        manifest_json TEXT NOT NULL
      );
    `);
    this.ensureProjectArchiveColumn();
  }

  upsertProject(manifest: ProjectManifest): void {
    const statement = this.database.prepare(`
      INSERT INTO projects (project_id, title, root_path, updated_at, archived_at, manifest_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        title = excluded.title,
        root_path = excluded.root_path,
        updated_at = excluded.updated_at,
        archived_at = excluded.archived_at,
        manifest_json = excluded.manifest_json
    `);

    statement.run(
      manifest.projectId,
      manifest.title,
      manifest.rootPath,
      manifest.updatedAt,
      manifest.archivedAt ?? null,
      JSON.stringify(manifest)
    );
  }

  listProjects(): ProjectManifest[] {
    const statement = this.database.prepare(
      "SELECT manifest_json FROM projects WHERE archived_at IS NULL ORDER BY updated_at DESC"
    );
    const rows = statement.all() as Array<{ manifest_json: string }>;
    return rows.map((row) => JSON.parse(row.manifest_json) as ProjectManifest);
  }

  listArchivedProjects(): ProjectManifest[] {
    const statement = this.database.prepare(
      "SELECT manifest_json FROM projects WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, updated_at DESC"
    );
    const rows = statement.all() as Array<{ manifest_json: string }>;
    return rows.map((row) => JSON.parse(row.manifest_json) as ProjectManifest);
  }

  getProjectManifest(projectId: string): ProjectManifest | null {
    const statement = this.database.prepare("SELECT manifest_json FROM projects WHERE project_id = ? LIMIT 1");
    const row = statement.get(projectId) as { manifest_json: string } | undefined;
    return row ? (JSON.parse(row.manifest_json) as ProjectManifest) : null;
  }

  upsertCorpus(manifest: ReferenceCorpusManifest): void {
    const statement = this.database.prepare(`
      INSERT INTO corpora (corpus_id, title, created_at, manifest_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(corpus_id) DO UPDATE SET
        title = excluded.title,
        created_at = excluded.created_at,
        manifest_json = excluded.manifest_json
    `);

    statement.run(manifest.corpusId, manifest.title, manifest.createdAt, JSON.stringify(manifest));
  }

  listCorpora(): ReferenceCorpusManifest[] {
    const statement = this.database.prepare("SELECT manifest_json FROM corpora ORDER BY created_at DESC");
    const rows = statement.all() as Array<{ manifest_json: string }>;
    return rows.map((row) => JSON.parse(row.manifest_json) as ReferenceCorpusManifest);
  }

  hasCorpus(corpusId: string): boolean {
    const statement = this.database.prepare("SELECT corpus_id FROM corpora WHERE corpus_id = ? LIMIT 1");
    const row = statement.get(corpusId) as { corpus_id: string } | undefined;
    return Boolean(row);
  }

  replaceCorpusChunks(corpusId: string, chunks: CorpusChunk[]): void {
    const deleteStatement = this.database.prepare("DELETE FROM corpus_chunks WHERE corpus_id = ?");
    deleteStatement.run(corpusId);

    const insertStatement = this.database.prepare(`
      INSERT INTO corpus_chunks (chunk_id, corpus_id, chapter_title, content, position, vector_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.database.exec("BEGIN");
    try {
      for (const chunk of chunks) {
        insertStatement.run(
          chunk.chunkId,
          chunk.corpusId,
          chunk.chapterTitle,
          chunk.content,
          chunk.position,
          chunk.vector ? JSON.stringify(chunk.vector) : null
        );
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  getCorpusChunks(corpusIds?: string[]): CorpusChunk[] {
    let rows: Array<{
      chunk_id: string;
      corpus_id: string;
      chapter_title: string;
      content: string;
      position: number;
      vector_json: string | null;
    }>;

    if (corpusIds && corpusIds.length > 0) {
      const placeholders = corpusIds.map(() => "?").join(", ");
      const statement = this.database.prepare(
        `SELECT * FROM corpus_chunks WHERE corpus_id IN (${placeholders}) ORDER BY position ASC`
      );
      rows = statement.all(...corpusIds) as typeof rows;
    } else {
      const statement = this.database.prepare("SELECT * FROM corpus_chunks ORDER BY position ASC");
      rows = statement.all() as typeof rows;
    }

    return rows.map((row) => ({
      chunkId: row.chunk_id,
      corpusId: row.corpus_id,
      chapterTitle: row.chapter_title,
      content: row.content,
      position: row.position,
      vector: row.vector_json ? (JSON.parse(row.vector_json) as number[]) : undefined
    }));
  }

  close(): void {
    this.database.close();
  }

  deleteProject(projectId: string): void {
    const statement = this.database.prepare("DELETE FROM projects WHERE project_id = ?");
    statement.run(projectId);
  }

  // ── Drama project CRUD ────────────────────────

  upsertDramaProject(manifest: DramaProjectManifest): void {
    const statement = this.database.prepare(`
      INSERT INTO drama_projects (project_id, title, root_path, updated_at, archived_at, manifest_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        title = excluded.title,
        root_path = excluded.root_path,
        updated_at = excluded.updated_at,
        archived_at = excluded.archived_at,
        manifest_json = excluded.manifest_json
    `);
    statement.run(
      manifest.projectId,
      manifest.title,
      manifest.rootPath,
      manifest.updatedAt,
      manifest.archivedAt ?? null,
      JSON.stringify(manifest)
    );
  }

  listDramaProjects(): DramaProjectManifest[] {
    const statement = this.database.prepare(
      "SELECT manifest_json FROM drama_projects WHERE archived_at IS NULL ORDER BY updated_at DESC"
    );
    const rows = statement.all() as Array<{ manifest_json: string }>;
    return rows.map((row) => JSON.parse(row.manifest_json) as DramaProjectManifest);
  }

  listArchivedDramaProjects(): DramaProjectManifest[] {
    const statement = this.database.prepare(
      "SELECT manifest_json FROM drama_projects WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, updated_at DESC"
    );
    const rows = statement.all() as Array<{ manifest_json: string }>;
    return rows.map((row) => JSON.parse(row.manifest_json) as DramaProjectManifest);
  }

  getDramaProjectManifest(projectId: string): DramaProjectManifest | null {
    const statement = this.database.prepare("SELECT manifest_json FROM drama_projects WHERE project_id = ? LIMIT 1");
    const row = statement.get(projectId) as { manifest_json: string } | undefined;
    return row ? (JSON.parse(row.manifest_json) as DramaProjectManifest) : null;
  }

  deleteDramaProject(projectId: string): void {
    const statement = this.database.prepare("DELETE FROM drama_projects WHERE project_id = ?");
    statement.run(projectId);
  }

  private ensureProjectArchiveColumn(): void {
    const statement = this.database.prepare("PRAGMA table_info(projects)");
    const columns = statement.all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "archived_at")) {
      this.database.exec("ALTER TABLE projects ADD COLUMN archived_at TEXT");
    }
  }
}

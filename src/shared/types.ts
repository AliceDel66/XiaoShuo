export type WorkflowMode = "strict" | "flexible";

export type WorkflowStage =
  | "initiative"
  | "bible"
  | "outlining"
  | "drafting"
  | "state-sync"
  | "audit"
  | "export";

export type WorkflowAction =
  | "generate-project-setup"
  | "generate-story-bible"
  | "generate-volume-outline"
  | "generate-chapter-outline"
  | "write-scene"
  | "write-chapter"
  | "update-chapter-state"
  | "run-audit"
  | "export-project";

export type ExportFormat = "markdown" | "txt" | "epub";

export type CorpusSourceType = "builtin" | "imported";

export type LicenseStatus = "sample" | "authorized" | "user-provided";

export type ChunkScope = "scene" | "chapter";

export type ArtifactType =
  | "premise-card"
  | "story-bible"
  | "volume-outline"
  | "chapter-outline"
  | "draft"
  | "chapter-state"
  | "audit-report";

export type ArtifactEditorMode = "form" | "raw";

export type ArtifactFormat = "yaml" | "markdown" | "text";

export type PreviewSessionStatus = "running" | "candidate-ready" | "confirmed" | "discarded" | "failed";

export type GenerationPhase =
  | "queued"
  | "preflight"
  | "retrieval"
  | "prompt-ready"
  | "model-running"
  | "parsing"
  | "candidate-ready"
  | "saving"
  | "completed"
  | "failed";

export interface TemperaturePolicy {
  planner: number;
  writer: number;
  auditor: number;
}

export interface ModelProfile {
  baseUrl: string;
  apiKey: string;
  plannerModel: string;
  writerModel: string;
  auditorModel: string;
  embeddingModel?: string;
  temperaturePolicy: TemperaturePolicy;
}

export type ModelConnectionCheckTarget = "provider" | "planner" | "writer" | "auditor" | "embedding";

export type ModelConnectionCheckStatus = "success" | "failed" | "skipped";

export interface ModelConnectionCheck {
  target: ModelConnectionCheckTarget;
  label: string;
  status: ModelConnectionCheckStatus;
  detail: string;
  model?: string;
  latencyMs?: number;
}

export interface ModelConnectionTestResult {
  ok: boolean;
  provider: string;
  checkedAt: string;
  summary: string;
  checks: ModelConnectionCheck[];
}

export interface PromptTemplate {
  systemTemplate: string;
  userTemplate: string;
}

export type PromptTemplateMap = Record<WorkflowAction, PromptTemplate>;

export interface EditorPreferences {
  autoSaveMs: number;
  editorWidth: number;
  fontSize: number;
  lineHeight: number;
}

export interface StartupPreferences {
  reopenLastProject: boolean;
  lastOpenedProjectId: string | null;
}

export interface ProjectDefaults {
  genre: string;
  targetWords: number;
  plannedVolumes: number;
  endingType: string;
  workflowMode: WorkflowMode;
  defaultRootDirectory: string;
}

export interface ExportPreferences {
  preferredFormat: ExportFormat;
  lastExportedFormat: ExportFormat | null;
  lastExportedPath: string;
  lastExportedAt: string | null;
}

export interface WorkbenchSettings {
  editorPreferences: EditorPreferences;
  startupPreferences: StartupPreferences;
  projectDefaults: ProjectDefaults;
  promptTemplates: PromptTemplateMap;
  exportPreferences: ExportPreferences;
}

export interface ProjectManifest {
  projectId: string;
  title: string;
  premise: string;
  genre: string;
  targetWords: number;
  plannedVolumes: number;
  endingType: string;
  workflowMode: WorkflowMode;
  currentStage: WorkflowStage;
  currentChapter: string | null;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface PremiseCard {
  coreSellingPoints: string[];
  targetWords: number;
  volumePlan: string[];
  protagonistGrowthCurve: string[];
  mainConflict: string;
  endingType: string;
}

export interface WorldEntry {
  title: string;
  summary: string;
  rules: string[];
}

export interface CharacterCard {
  id: string;
  name: string;
  role: string;
  goal: string;
  conflict: string;
  arc: string;
  secrets: string[];
  currentStatus: string;
}

export interface TimelineEvent {
  id: string;
  timeLabel: string;
  description: string;
  relatedCharacters: string[];
  chapterRef?: string;
}

export interface FactionEntry {
  id: string;
  name: string;
  agenda: string;
  resources: string[];
  relationshipToProtagonist: string;
}

export interface ItemEntry {
  id: string;
  name: string;
  purpose: string;
  owner: string;
  status: string;
}

export interface ForeshadowEntry {
  id: string;
  clue: string;
  plantedAt: string;
  payoffPlan: string;
  status: "open" | "paid-off" | "delayed";
}

export interface StoryBible {
  world: WorldEntry[];
  characters: CharacterCard[];
  factions: FactionEntry[];
  items: ItemEntry[];
  timeline: TimelineEvent[];
  foreshadows: ForeshadowEntry[];
}

export interface OutlineReference {
  type: "project" | "corpus";
  id: string;
  title: string;
  note: string;
}

export interface OutlinePacket {
  id: string;
  level: "volume" | "chapter" | "scene";
  title: string;
  summary: string;
  goal: string;
  conflict: string;
  hook: string;
  sceneCount: number;
  dependencies: string[];
  references: OutlineReference[];
  children: string[];
  chapterNumber?: number;
  volumeNumber?: number;
}

export interface StateChangeEntry {
  target: string;
  before: string;
  after: string;
  reason: string;
}

export interface ChapterStateDelta {
  chapterId: string;
  chapterTitle: string;
  characterStates: StateChangeEntry[];
  timelineEvents: TimelineEvent[];
  foreshadowChanges: StateChangeEntry[];
  relationshipChanges: StateChangeEntry[];
  locationChanges: StateChangeEntry[];
  openQuestions: string[];
  updatedAt: string;
}

export interface AuditFinding {
  severity: "info" | "warning" | "blocking";
  title: string;
  detail: string;
  chapterRef?: string;
}

export interface AuditReport {
  id: string;
  projectId: string;
  createdAt: string;
  continuityFindings: AuditFinding[];
  pacingFindings: AuditFinding[];
  characterFindings: AuditFinding[];
  mainlineFindings: AuditFinding[];
  blockingIssues: string[];
  suggestedFixes: string[];
}

export interface ReferenceAnalysisArtifacts {
  structureProfile: {
    openingHook: string;
    escalationPattern: string;
    suspenseDensity: string;
    sceneCadence: string;
    foreshadowCadence: string;
    volumeDistribution: string;
  };
  voiceProfile: {
    averageParagraphLength: number;
    dialogueRatio: number;
    emotionIntensity: string;
    narrationBias: string;
    evidence: string[];
  };
}

export interface ReferenceCorpusManifest {
  corpusId: string;
  title: string;
  sourceType: CorpusSourceType;
  licenseStatus: LicenseStatus;
  encoding: string;
  chapterPattern: string;
  analysisArtifacts: ReferenceAnalysisArtifacts;
  indexStatus: "pending" | "ready";
  filePath: string;
  createdAt: string;
}

export interface CorpusChunk {
  chunkId: string;
  corpusId: string;
  chapterTitle: string;
  content: string;
  position: number;
  vector?: number[];
}

export interface SearchResult {
  corpusId: string;
  chunkId: string;
  title: string;
  snippet: string;
  score: number;
}

export interface WorkflowWarning {
  level: "warning" | "blocking";
  message: string;
}

export interface ChapterDraft {
  id: string;
  title: string;
  chapterNumber: number;
  volumeNumber: number;
  scope: ChunkScope;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRef {
  artifactType: ArtifactType;
  artifactId: string;
  projectId: string;
}

export interface GenerationProgress {
  phase: GenerationPhase;
  percent: number;
  message: string;
}

export interface GenerationJob {
  jobId: string;
  sessionId: string;
  projectId: string;
  action: WorkflowAction;
  status: "running" | "completed" | "failed";
  progress: GenerationProgress;
  startedAt: string;
  finishedAt?: string;
  targetArtifact: ArtifactRef;
  errorMessage?: string;
}

export interface GenerationTraceEntry {
  phase: GenerationPhase;
  title: string;
  detail: string;
  timestamp: string;
  level: "info" | "warning" | "error";
}

export interface GenerationPromptTrace {
  systemPrompt: string;
  userPrompt: string;
  referenceContext: string[];
  projectContextSummary: string[];
}

export interface PreviewCandidate {
  candidateId: string;
  sessionId: string;
  versionNumber: number;
  artifactType: ArtifactType;
  displayTitle: string;
  format: ArtifactFormat;
  renderedContent: string;
  structuredPayload?: unknown;
  /** Whether this candidate was produced by the model or by local fallback/mock. */
  source?: "model" | "fallback";
  createdAt: string;
}

export interface PreviewSession {
  sessionId: string;
  projectId: string;
  action: WorkflowAction;
  artifactRef: ArtifactRef;
  request: WorkflowExecutionInput;
  status: PreviewSessionStatus;
  warnings: WorkflowWarning[];
  candidates: PreviewCandidate[];
  selectedCandidateId: string | null;
  trace: GenerationTraceEntry[];
  promptTrace: GenerationPromptTrace | null;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

export interface ArtifactEditorDocument {
  artifactRef: ArtifactRef;
  mode: ArtifactEditorMode;
  displayTitle: string;
  format: ArtifactFormat;
  rawText: string;
  structuredPayload?: unknown;
  isDirty: boolean;
}

export interface WorkflowResult {
  action: WorkflowAction;
  warnings: WorkflowWarning[];
  updatedProject: ProjectSnapshot;
  createdPaths: string[];
}

export interface ProjectSnapshot {
  manifest: ProjectManifest;
  premiseCard: PremiseCard | null;
  storyBible: StoryBible | null;
  outlines: OutlinePacket[];
  drafts: ChapterDraft[];
  chapterStates: ChapterStateDelta[];
  audits: AuditReport[];
  unresolvedWarnings: WorkflowWarning[];
}

export interface DashboardData {
  modelProfile: ModelProfile;
  settings: WorkbenchSettings;
  projects: ProjectManifest[];
  archivedProjects: ProjectManifest[];
  corpora: ReferenceCorpusManifest[];
  selectedProject: ProjectSnapshot | null;
  activeJob: GenerationJob | null;
  activePreviewSession: PreviewSession | null;
}

export interface CreateProjectInput {
  title: string;
  premise: string;
  genre: string;
  targetWords: number;
  plannedVolumes: number;
  endingType: string;
  workflowMode: WorkflowMode;
  rootDirectory?: string;
}

export interface WorkflowExecutionInput {
  projectId: string;
  action: WorkflowAction;
  chapterTitle?: string;
  chapterNumber?: number;
  volumeNumber?: number;
  chapterCount?: number;
  scope?: ChunkScope;
  notes?: string;
  referenceCorpusIds?: string[];
}

export interface ImportCorpusInput {
  filePath: string;
  sourceType: CorpusSourceType;
  licenseStatus: LicenseStatus;
  title?: string;
}

export interface SearchCorpusInput {
  query: string;
  corpusIds?: string[];
  limit?: number;
}

export interface ExportProjectInput {
  projectId: string;
  format: ExportFormat;
}

export type GenerationEvent =
  | { type: "job-updated"; job: GenerationJob }
  | { type: "session-updated"; session: PreviewSession }
  | { type: "job-cleared" };

export interface AppApi {
  getDashboardData: () => Promise<DashboardData>;
  saveModelProfile: (profile: ModelProfile) => Promise<ModelProfile>;
  testModelProfileConnection: (profile: ModelProfile) => Promise<ModelConnectionTestResult>;
  saveWorkbenchSettings: (settings: WorkbenchSettings) => Promise<WorkbenchSettings>;
  createProject: (input: CreateProjectInput) => Promise<ProjectSnapshot>;
  getProject: (projectId: string) => Promise<ProjectSnapshot>;
  archiveProject: (projectId: string) => Promise<DashboardData>;
  restoreProject: (projectId: string) => Promise<DashboardData>;
  deleteProject: (projectId: string) => Promise<DashboardData>;
  importCorpus: (input: ImportCorpusInput) => Promise<ReferenceCorpusManifest>;
  searchCorpus: (input: SearchCorpusInput) => Promise<SearchResult[]>;
  exportProject: (input: ExportProjectInput) => Promise<string>;
  pickCorpusFile: () => Promise<string | null>;
  startGeneration: (input: WorkflowExecutionInput) => Promise<{ jobId: string; sessionId: string }>;
  subscribeGenerationEvents: (listener: (event: GenerationEvent) => void) => () => void;
  getPreviewSession: (sessionId: string) => Promise<PreviewSession>;
  regenerateCandidate: (sessionId: string) => Promise<{ jobId: string }>;
  confirmCandidate: (sessionId: string, candidateId: string) => Promise<ProjectSnapshot>;
  discardPreviewSession: (sessionId: string) => Promise<void>;
  openArtifactEditor: (artifactRef: ArtifactRef) => Promise<ArtifactEditorDocument>;
  saveArtifactEdits: (document: ArtifactEditorDocument) => Promise<ProjectSnapshot>;
  createEmptyDraft: (projectId: string, volumeNumber: number, chapterNumber: number, chapterTitle: string) => Promise<ProjectSnapshot>;
  executeWorkflow: (input: WorkflowExecutionInput) => Promise<WorkflowResult>;
}

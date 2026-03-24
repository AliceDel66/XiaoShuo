import type {
  AppApi,
  ArtifactEditorDocument,
  ArtifactRef,
  ChunkScope,
  CreateProjectInput,
  DashboardData,
  GenerationJob,
  ModelProfile,
  OutlinePacket,
  PreviewCandidate,
  PreviewSession,
  ProjectSnapshot,
  ReferenceCorpusManifest,
  SearchResult,
  StoryBible,
  WorkbenchSettings,
  WorkflowAction
} from "@shared/types";

export type WorkbenchView = "dashboard" | "editor" | "outline" | "database" | "settings";

export type DrawerState =
  | { kind: "artifact"; document: ArtifactEditorDocument; error?: string | null }
  | { kind: "prompt"; session: PreviewSession }
  | { kind: "context"; session: PreviewSession; selectedCorpora: ReferenceCorpusManifest[] }
  | null;

export interface WorkbenchChapterItem {
  key: string;
  title: string;
  volumeNumber: number;
  chapterNumber: number;
  draftId: string | null;
  draftTitle: string | null;
  outlineId: string | null;
  draftMarkdown: string | null;
  outline: OutlinePacket | null;
}

export interface DatabaseCategoryOption {
  key: DatabaseCategoryKey;
  label: string;
  count: number;
}

export type DatabaseCategoryKey = "all" | "characters" | "world" | "factions" | "items" | "timeline" | "foreshadows";

export interface DatabaseEntityRecord {
  id: string;
  category: DatabaseCategoryKey;
  typeLabel: string;
  title: string;
  subtitle: string;
  description: string;
  searchText: string;
  payload: unknown;
}

export interface WorkflowDraftState {
  volumeNumber: number;
  chapterNumber: number;
  scope: ChunkScope;
  notes: string;
}

export interface WorkbenchState {
  loading: boolean;
  error: string | null;
  notice: string | null;
  activeView: WorkbenchView;
  dashboardData: DashboardData | null;
  selectedProject: ProjectSnapshot | null;
  selectedProjectId: string | null;
  selectedCorpusIds: string[];
  searchQuery: string;
  searchResults: SearchResult[];
  activeCandidateId: string | null;
  drawer: DrawerState;
  projectForm: CreateProjectInput;
  modelProfileDraft: ModelProfile;
  settingsDraft: WorkbenchSettings;
  workflowDraft: WorkflowDraftState;
  activeJob: GenerationJob | null;
  activePreviewSession: PreviewSession | null;
  selectedCandidate: PreviewCandidate | null;
  busy: Record<string, boolean>;
}

export interface SaveStatus {
  state: "idle" | "saving" | "saved" | "error";
  message: string;
}

export interface WorkbenchActions {
  setActiveView: (view: WorkbenchView) => void;
  setSearchQuery: (value: string) => void;
  setActiveCandidateId: (candidateId: string | null) => void;
  setProjectForm: (updater: (current: CreateProjectInput) => CreateProjectInput) => void;
  setModelProfileDraft: (updater: (current: ModelProfile) => ModelProfile) => void;
  setSettingsDraft: (updater: (current: WorkbenchSettings) => WorkbenchSettings) => void;
  setWorkflowDraft: (updater: (current: WorkflowDraftState) => WorkflowDraftState) => void;
  selectProject: (projectId: string) => Promise<void>;
  toggleCorpus: (corpusId: string) => void;
  importCorpus: () => Promise<void>;
  createProject: () => Promise<void>;
  archiveProject: (projectId: string) => Promise<void>;
  restoreProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  startWorkflow: (action: WorkflowAction, overrides?: Partial<WorkflowDraftState>) => Promise<void>;
  confirmCandidate: (candidateId: string) => Promise<void>;
  regenerateCandidate: () => Promise<void>;
  discardSession: () => Promise<void>;
  openArtifact: (artifactRef: ArtifactRef) => Promise<void>;
  loadArtifactDocument: (artifactRef: ArtifactRef) => Promise<ArtifactEditorDocument | null>;
  saveArtifactDocument: (document: ArtifactEditorDocument) => Promise<ProjectSnapshot | null>;
  createEmptyDraft: (volumeNumber: number, chapterNumber: number, chapterTitle: string) => Promise<void>;
  openPromptDrawer: () => void;
  openContextDrawer: () => void;
  closeDrawer: () => void;
  updateDrawerDocument: (updater: (current: ArtifactEditorDocument) => ArtifactEditorDocument) => void;
  saveDrawerDocument: () => Promise<void>;
  exportProject: (format: "markdown" | "txt" | "epub") => Promise<void>;
  saveModelProfile: () => Promise<void>;
  saveWorkbenchSettings: () => Promise<void>;
  resetPromptTemplate: (action: WorkflowAction) => void;
  refresh: () => Promise<void>;
}

export interface WorkbenchHookResult {
  state: WorkbenchState;
  actions: WorkbenchActions;
}

export interface WorkbenchAppProps {
  api: AppApi;
}

export function isStoryBibleCategory(category: DatabaseCategoryKey, bible: StoryBible | null): boolean {
  return category !== "all" && Boolean(bible);
}

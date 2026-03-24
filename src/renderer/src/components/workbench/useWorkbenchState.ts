import {
  DEFAULT_MODEL_PROFILE,
  DEFAULT_PROMPT_TEMPLATES,
  DEFAULT_WORKBENCH_SETTINGS,
  createProjectInputFromDefaults
} from "@shared/defaults";
import type {
  AppApi,
  ArtifactEditorDocument,
  ArtifactRef,
  DashboardData,
  ModelConnectionTestResult,
  ProjectSnapshot,
  SearchResult,
  WorkbenchSettings,
  WorkflowAction,
  WorkflowExecutionInput
} from "@shared/types";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { DrawerState, WorkbenchHookResult, WorkflowDraftState } from "./types";
import { buildProjectFormFromSettings, candidateFromSession, findMatchingChapter } from "./view-model";

function defaultWorkflowDraft(): WorkflowDraftState {
  return {
    volumeNumber: 1,
    chapterNumber: 1,
    scope: "chapter",
    notes: ""
  };
}

export function useWorkbenchState(api: AppApi): WorkbenchHookResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "editor" | "outline" | "database" | "settings">(
    "dashboard"
  );
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectSnapshot | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCorpusIds, setSelectedCorpusIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [projectForm, setProjectFormState] = useState(createProjectInputFromDefaults());
  const [modelProfileDraft, setModelProfileDraftState] = useState(DEFAULT_MODEL_PROFILE);
  const [connectionTestResult, setConnectionTestResult] = useState<ModelConnectionTestResult | null>(null);
  const [settingsDraft, setSettingsDraftState] = useState(DEFAULT_WORKBENCH_SETTINGS);
  const [workflowDraft, setWorkflowDraftState] = useState<WorkflowDraftState>(defaultWorkflowDraft);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const noticeTimerRef = useRef<number | null>(null);
  const selectedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  const setBusyFlag = useCallback((key: string, value: boolean) => {
    setBusy((current) => ({
      ...current,
      [key]: value
    }));
  }, []);

  const setProjectForm = useCallback((updater: (current: typeof projectForm) => typeof projectForm) => {
    setProjectFormState((current) => updater(current));
  }, []);

  const setModelProfileDraft = useCallback((updater: (current: typeof modelProfileDraft) => typeof modelProfileDraft) => {
    setModelProfileDraftState((current) => updater(current));
    setConnectionTestResult(null);
  }, []);

  const setSettingsDraft = useCallback((updater: (current: typeof settingsDraft) => typeof settingsDraft) => {
    setSettingsDraftState((current) => updater(current));
  }, []);

  const setWorkflowDraft = useCallback((updater: (current: WorkflowDraftState) => WorkflowDraftState) => {
    setWorkflowDraftState((current) => updater(current));
  }, []);

  const pushNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 3200);
  }, []);

  const applyDashboardData = useCallback(
    async (data: DashboardData, preferredProjectId?: string | null) => {
      const manifests = [...data.projects, ...data.archivedProjects];
      const preferredId =
        preferredProjectId && manifests.some((project) => project.projectId === preferredProjectId)
          ? preferredProjectId
          : data.selectedProject?.manifest.projectId ?? manifests[0]?.projectId ?? null;
      const resolvedProject =
        !preferredId
          ? null
          : data.selectedProject?.manifest.projectId === preferredId
            ? data.selectedProject
            : await api.getProject(preferredId);

      startTransition(() => {
        setDashboardData({
          ...data,
          selectedProject: resolvedProject
        });
        setSelectedProject(resolvedProject);
        setSelectedProjectId(resolvedProject?.manifest.projectId ?? null);
        setModelProfileDraftState(data.modelProfile);
        setConnectionTestResult(null);
        setSettingsDraftState(data.settings);
        setProjectFormState(buildProjectFormFromSettings(data.settings));
        setSelectedCorpusIds((current) => {
          const valid = current.filter((corpusId) => data.corpora.some((corpus) => corpus.corpusId === corpusId));
          return valid.length > 0 ? valid : data.activePreviewSession?.request.referenceCorpusIds ?? [];
        });
        setActiveCandidateId(
          data.activePreviewSession?.selectedCandidateId ?? data.activePreviewSession?.candidates.at(-1)?.candidateId ?? null
        );
      });
    },
    [api]
  );

  const refresh = useCallback(
    async (preferredProjectId?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getDashboardData();
        await applyDashboardData(data, preferredProjectId ?? selectedProjectIdRef.current);
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
      } finally {
        setLoading(false);
      }
    },
    [api, applyDashboardData]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return api.subscribeGenerationEvents((event) => {
      if (event.type === "job-updated" && event.job) {
        setDashboardData((current) => (current ? { ...current, activeJob: event.job } : current));
        return;
      }

      if (event.type === "job-cleared") {
        setDashboardData((current) => (current ? { ...current, activeJob: null } : current));
        return;
      }

      if (event.type === "session-updated" && event.session) {
        setDashboardData((current) => (current ? { ...current, activePreviewSession: event.session } : current));
        setActiveCandidateId(
          event.session.selectedCandidateId ?? event.session.candidates.at(-1)?.candidateId ?? null
        );
      }
    });
  }, [api]);

  useEffect(() => {
    if (!deferredSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setBusyFlag("search", true);
    void api
      .searchCorpus({
        query: deferredSearchQuery,
        corpusIds: selectedCorpusIds.length > 0 ? selectedCorpusIds : undefined,
        limit: 6
      })
      .then((results) => {
        if (!cancelled) {
          setSearchResults(results);
        }
      })
      .catch((searchError) => {
        if (!cancelled) {
          setError(searchError instanceof Error ? searchError.message : String(searchError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusyFlag("search", false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, deferredSearchQuery, selectedCorpusIds, setBusyFlag]);

  const saveStartupSelection = useCallback(
    async (projectId: string | null) => {
      const baseSettings = dashboardData?.settings ?? settingsDraft;
      const nextSettings: WorkbenchSettings = {
        ...baseSettings,
        startupPreferences: {
          ...baseSettings.startupPreferences,
          lastOpenedProjectId: projectId
        }
      };
      const saved = await api.saveWorkbenchSettings(nextSettings);
      setDashboardData((current) => (current ? { ...current, settings: saved } : current));
      setSettingsDraftState((current) => ({
        ...current,
        startupPreferences: saved.startupPreferences
      }));
    },
    [api, dashboardData?.settings, settingsDraft]
  );

  const selectProject = useCallback(
    async (projectId: string) => {
      setBusyFlag("select-project", true);
      setError(null);
      try {
        const snapshot = await api.getProject(projectId);
        await saveStartupSelection(projectId);
        setSelectedProject(snapshot);
        setSelectedProjectId(projectId);
        setDashboardData((current) => (current ? { ...current, selectedProject: snapshot } : current));
        setWorkflowDraftState((current) => ({
          ...current,
          volumeNumber: 1,
          chapterNumber: snapshot.drafts.at(-1)?.chapterNumber ?? snapshot.outlines.find((item) => item.level === "chapter")?.chapterNumber ?? 1
        }));
      } catch (selectionError) {
        setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
      } finally {
        setBusyFlag("select-project", false);
      }
    },
    [api, saveStartupSelection, setBusyFlag]
  );

  const createProject = useCallback(async () => {
    if (!projectForm.title.trim()) {
      setError("请先填写项目标题。");
      return;
    }
    if (!projectForm.premise.trim()) {
      setError("请先填写一句话构思。");
      return;
    }

    setBusyFlag("create-project", true);
    setError(null);
    try {
      const snapshot = await api.createProject(projectForm);
      await refresh(snapshot.manifest.projectId);
      pushNotice(`已创建项目《${snapshot.manifest.title}》。`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setBusyFlag("create-project", false);
    }
  }, [api, projectForm, pushNotice, refresh, setBusyFlag]);

  const toggleCorpus = useCallback((corpusId: string) => {
    setSelectedCorpusIds((current) =>
      current.includes(corpusId) ? current.filter((id) => id !== corpusId) : [...current, corpusId]
    );
  }, []);

  const importCorpus = useCallback(async () => {
    setBusyFlag("import-corpus", true);
    setError(null);
    try {
      const filePath = await api.pickCorpusFile();
      if (!filePath) {
        return;
      }

      const imported = await api.importCorpus({
        filePath,
        sourceType: "imported",
        licenseStatus: "user-provided"
      });
      setDashboardData((current) =>
        current
          ? {
              ...current,
              corpora: [...current.corpora, imported]
            }
          : current
      );
      setSelectedCorpusIds((current) => Array.from(new Set([...current, imported.corpusId])));
      pushNotice(`已导入参考书《${imported.title}》。`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setBusyFlag("import-corpus", false);
    }
  }, [api, pushNotice, setBusyFlag]);

  const archiveProject = useCallback(
    async (projectId: string) => {
      setBusyFlag("archive-project", true);
      setError(null);
      try {
        const data = await api.archiveProject(projectId);
        const nextPreferred = selectedProjectId === projectId ? data.projects[0]?.projectId ?? data.archivedProjects[0]?.projectId ?? null : selectedProjectId;
        await applyDashboardData(data, nextPreferred);
        pushNotice("项目已归档。");
      } catch (archiveError) {
        setError(archiveError instanceof Error ? archiveError.message : String(archiveError));
      } finally {
        setBusyFlag("archive-project", false);
      }
    },
    [api, applyDashboardData, pushNotice, selectedProjectId, setBusyFlag]
  );

  const restoreProject = useCallback(
    async (projectId: string) => {
      setBusyFlag("restore-project", true);
      setError(null);
      try {
        const data = await api.restoreProject(projectId);
        await applyDashboardData(data, projectId);
        pushNotice("项目已恢复到工作区。");
      } catch (restoreError) {
        setError(restoreError instanceof Error ? restoreError.message : String(restoreError));
      } finally {
        setBusyFlag("restore-project", false);
      }
    },
    [api, applyDashboardData, pushNotice, setBusyFlag]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      setBusyFlag("delete-project", true);
      setError(null);
      try {
        const data = await api.deleteProject(projectId);
        const nextPreferred = selectedProjectId === projectId ? data.projects[0]?.projectId ?? null : selectedProjectId;
        await applyDashboardData(data, nextPreferred);
        pushNotice("项目已永久删除。");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
      } finally {
        setBusyFlag("delete-project", false);
      }
    },
    [api, applyDashboardData, pushNotice, selectedProjectId, setBusyFlag]
  );

  const buildWorkflowInput = useCallback(
    (action: WorkflowAction, overrides?: Partial<WorkflowDraftState>): WorkflowExecutionInput | null => {
      if (!selectedProject) {
        setError("请先选择项目。");
        return null;
      }

      const nextDraft = { ...workflowDraft, ...overrides };
      const chapter = findMatchingChapter(selectedProject, nextDraft.volumeNumber, nextDraft.chapterNumber);
      const input: WorkflowExecutionInput = {
        projectId: selectedProject.manifest.projectId,
        action,
        notes: nextDraft.notes.trim() || undefined,
        referenceCorpusIds: selectedCorpusIds.length > 0 ? selectedCorpusIds : undefined
      };

      if (action === "generate-chapter-outline" || action === "write-scene" || action === "write-chapter") {
        input.volumeNumber = nextDraft.volumeNumber;
        input.chapterNumber = nextDraft.chapterNumber;
        input.chapterTitle = chapter?.title ?? `第${nextDraft.chapterNumber}章`;
        input.scope = nextDraft.scope;
      }

      if (action === "generate-volume-outline") {
        input.volumeNumber = nextDraft.volumeNumber;
      }

      if (action === "update-chapter-state") {
        input.chapterNumber = nextDraft.chapterNumber;
        input.chapterTitle = chapter?.title ?? `第${nextDraft.chapterNumber}章`;
      }

      if (action === "export-project") {
        input.referenceCorpusIds = undefined;
        input.notes = undefined;
      }

      return input;
    },
    [selectedCorpusIds, selectedProject, workflowDraft]
  );

  const startWorkflow = useCallback(
    async (action: WorkflowAction, overrides?: Partial<WorkflowDraftState>) => {
      const input = buildWorkflowInput(action, overrides);
      if (!input) {
        return;
      }

      // Bug fix: if there's already an active session for the same action,
      // reuse it so existing candidates are preserved (regenerate instead of creating new session)
      const existingSession = dashboardData?.activePreviewSession;
      if (existingSession && existingSession.action === action && existingSession.candidates.length > 0) {
        setBusyFlag("start-workflow", true);
        setError(null);
        try {
          await api.regenerateCandidate(existingSession.sessionId);
          pushNotice(`正在重新生成 ${action}（保留已有候选版本）。`);
        } catch (workflowError) {
          setError(workflowError instanceof Error ? workflowError.message : String(workflowError));
        } finally {
          setBusyFlag("start-workflow", false);
        }
        return;
      }

      setBusyFlag("start-workflow", true);
      setError(null);
      try {
        const started = await api.startGeneration(input);
        const session = await api.getPreviewSession(started.sessionId);
        setDashboardData((current) =>
          current
            ? {
                ...current,
                activePreviewSession: session
              }
            : current
        );
        setActiveCandidateId(session.selectedCandidateId ?? session.candidates.at(-1)?.candidateId ?? null);
        pushNotice(`已启动 ${action}。`);
      } catch (workflowError) {
        setError(workflowError instanceof Error ? workflowError.message : String(workflowError));
      } finally {
        setBusyFlag("start-workflow", false);
      }
    },
    [api, buildWorkflowInput, dashboardData?.activePreviewSession, pushNotice, setBusyFlag]
  );

  const confirmCandidate = useCallback(
    async (candidateId: string) => {
      const session = dashboardData?.activePreviewSession;
      if (!session) {
        setError("当前没有可确认的候选版本。");
        return;
      }

      setBusyFlag("confirm-candidate", true);
      setError(null);
      try {
        const snapshot = await api.confirmCandidate(session.sessionId, candidateId);
        setSelectedProject(snapshot);
        setDashboardData((current) =>
          current
            ? {
                ...current,
                selectedProject: snapshot,
                activePreviewSession: current.activePreviewSession
                  ? {
                      ...current.activePreviewSession,
                      status: "confirmed",
                      selectedCandidateId: candidateId
                    }
                  : null
              }
            : current
        );
        setActiveCandidateId(candidateId);
        setDrawer(null);
        pushNotice("候选版本已确认并写回正式文档。");
      } catch (confirmError) {
        setError(confirmError instanceof Error ? confirmError.message : String(confirmError));
      } finally {
        setBusyFlag("confirm-candidate", false);
      }
    },
    [api, dashboardData?.activePreviewSession, pushNotice, setBusyFlag]
  );

  const regenerateCandidate = useCallback(async () => {
    const session = dashboardData?.activePreviewSession;
    if (!session) {
      setError("当前没有可重生成的会话。");
      return;
    }

    setBusyFlag("regenerate-candidate", true);
    setError(null);
    try {
      await api.regenerateCandidate(session.sessionId);
      pushNotice("已开始重生成候选版本。");
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : String(regenerateError));
    } finally {
      setBusyFlag("regenerate-candidate", false);
    }
  }, [api, dashboardData?.activePreviewSession, pushNotice, setBusyFlag]);

  const discardSession = useCallback(async () => {
    const session = dashboardData?.activePreviewSession;
    if (!session) {
      return;
    }

    setBusyFlag("discard-session", true);
    setError(null);
    try {
      await api.discardPreviewSession(session.sessionId);
      setDashboardData((current) => (current ? { ...current, activePreviewSession: null } : current));
      setActiveCandidateId(null);
      pushNotice("候选会话已丢弃。");
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : String(discardError));
    } finally {
      setBusyFlag("discard-session", false);
    }
  }, [api, dashboardData?.activePreviewSession, pushNotice, setBusyFlag]);

  const openArtifact = useCallback(
    async (artifactRef: ArtifactRef) => {
      setBusyFlag("open-artifact", true);
      setError(null);
      try {
        const document = await api.openArtifactEditor(artifactRef);
        setDrawer({ kind: "artifact", document });
      } catch (artifactError) {
        setError(artifactError instanceof Error ? artifactError.message : String(artifactError));
      } finally {
        setBusyFlag("open-artifact", false);
      }
    },
    [api, setBusyFlag]
  );

  const loadArtifactDocument = useCallback(
    async (artifactRef: ArtifactRef) => {
      setError(null);
      try {
        return await api.openArtifactEditor(artifactRef);
      } catch (artifactError) {
        setError(artifactError instanceof Error ? artifactError.message : String(artifactError));
        return null;
      }
    },
    [api]
  );

  const updateDrawerDocument = useCallback((updater: (current: ArtifactEditorDocument) => ArtifactEditorDocument) => {
    setDrawer((current) => {
      if (!current || current.kind !== "artifact") {
        return current;
      }
      return {
        ...current,
        document: updater(current.document)
      };
    });
  }, []);

  const saveDrawerDocument = useCallback(async () => {
    if (!drawer || drawer.kind !== "artifact") {
      return;
    }

    setBusyFlag("save-artifact", true);
    setError(null);
    try {
      const snapshot = await api.saveArtifactEdits({
        ...drawer.document,
        isDirty: true
      });
      setSelectedProject(snapshot);
      setDashboardData((current) => (current ? { ...current, selectedProject: snapshot } : current));
      setDrawer({
        kind: "artifact",
        document: {
          ...drawer.document,
          isDirty: false
        }
      });
      pushNotice("正式文档已保存。");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(message);
      setDrawer({
        ...drawer,
        error: message
      });
    } finally {
      setBusyFlag("save-artifact", false);
    }
  }, [api, drawer, pushNotice, setBusyFlag]);

  const saveArtifactDocument = useCallback(
    async (document: ArtifactEditorDocument) => {
      try {
        const snapshot = await api.saveArtifactEdits(document);
        setSelectedProject(snapshot);
        setSelectedProjectId(snapshot.manifest.projectId);
        setDashboardData((current) => (current ? { ...current, selectedProject: snapshot } : current));
        return snapshot;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : String(saveError));
        return null;
      }
    },
    [api]
  );

  const createEmptyDraft = useCallback(
    async (volumeNumber: number, chapterNumber: number, chapterTitle: string) => {
      if (!selectedProject) {
        setError("请先选择项目。");
        return;
      }
      setBusyFlag("create-empty-draft", true);
      setError(null);
      try {
        const snapshot = await api.createEmptyDraft(selectedProject.manifest.projectId, volumeNumber, chapterNumber, chapterTitle);
        setSelectedProject(snapshot);
        setDashboardData((current) => (current ? { ...current, selectedProject: snapshot } : current));
        pushNotice(`已创建 ${chapterTitle} 的空白草稿，可以开始书写。`);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : String(createError));
      } finally {
        setBusyFlag("create-empty-draft", false);
      }
    },
    [api, pushNotice, selectedProject, setBusyFlag]
  );

  const exportProject = useCallback(
    async (format: "markdown" | "txt" | "epub") => {
      if (!selectedProject) {
        setError("请先选择一个项目。");
        return;
      }

      setBusyFlag("export-project", true);
      setError(null);
      try {
        const outputPath = await api.exportProject({
          projectId: selectedProject.manifest.projectId,
          format
        });
        await refresh(selectedProject.manifest.projectId);
        pushNotice(`已导出到 ${outputPath}`);
      } catch (exportError) {
        setError(exportError instanceof Error ? exportError.message : String(exportError));
      } finally {
        setBusyFlag("export-project", false);
      }
    },
    [api, pushNotice, refresh, selectedProject, setBusyFlag]
  );

  const testModelProfileConnection = useCallback(async () => {
    setBusyFlag("test-model-profile-connection", true);
    setError(null);
    try {
      const result = await api.testModelProfileConnection(modelProfileDraft);
      setConnectionTestResult(result);
      if (result.ok) {
        pushNotice("AI 连通性测试通过。");
      }
    } catch (testError) {
      setConnectionTestResult(null);
      setError(testError instanceof Error ? testError.message : String(testError));
    } finally {
      setBusyFlag("test-model-profile-connection", false);
    }
  }, [api, modelProfileDraft, pushNotice, setBusyFlag]);

  const saveModelProfile = useCallback(async () => {
    setBusyFlag("save-model-profile", true);
    setError(null);
    try {
      const saved = await api.saveModelProfile(modelProfileDraft);
      setModelProfileDraftState(saved);
      setDashboardData((current) => (current ? { ...current, modelProfile: saved } : current));
      pushNotice("AI 模型配置已保存。");
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : String(profileError));
    } finally {
      setBusyFlag("save-model-profile", false);
    }
  }, [api, modelProfileDraft, pushNotice, setBusyFlag]);

  const saveWorkbenchSettings = useCallback(async () => {
    setBusyFlag("save-settings", true);
    setError(null);
    try {
      const saved = await api.saveWorkbenchSettings(settingsDraft);
      setSettingsDraftState(saved);
      setDashboardData((current) => (current ? { ...current, settings: saved } : current));
      setProjectFormState(buildProjectFormFromSettings(saved));
      pushNotice("工作台设置已保存。");
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : String(settingsError));
    } finally {
      setBusyFlag("save-settings", false);
    }
  }, [api, pushNotice, settingsDraft, setBusyFlag]);

  const resetPromptTemplate = useCallback((action: WorkflowAction) => {
    setSettingsDraftState((current) => ({
      ...current,
      promptTemplates: {
        ...current.promptTemplates,
        [action]: DEFAULT_PROMPT_TEMPLATES[action]
      }
    }));
  }, []);

  const activePreviewSession = dashboardData?.activePreviewSession ?? null;
  const activeJob = dashboardData?.activeJob ?? null;
  const selectedCandidate = useMemo(
    () => candidateFromSession(activePreviewSession, activeCandidateId),
    [activeCandidateId, activePreviewSession]
  );

  const openPromptDrawer = useCallback(() => {
    if (activePreviewSession) {
      setDrawer({ kind: "prompt", session: activePreviewSession });
    }
  }, [activePreviewSession]);

  const openContextDrawer = useCallback(() => {
    if (activePreviewSession) {
      const selectedCorpora = dashboardData?.corpora.filter((corpus) => selectedCorpusIds.includes(corpus.corpusId)) ?? [];
      setDrawer({ kind: "context", session: activePreviewSession, selectedCorpora });
    }
  }, [activePreviewSession, dashboardData?.corpora, selectedCorpusIds]);

  const closeDrawer = useCallback(() => {
    setDrawer(null);
  }, []);

  const actions = useMemo(
    () => ({
      setActiveView,
      setSearchQuery,
      setActiveCandidateId,
      setProjectForm,
      setModelProfileDraft,
      setSettingsDraft,
      setWorkflowDraft,
      selectProject,
      toggleCorpus,
      importCorpus,
      createProject,
      archiveProject,
      restoreProject,
      deleteProject,
      startWorkflow,
      confirmCandidate,
      regenerateCandidate,
      discardSession,
      openArtifact,
      loadArtifactDocument,
      saveArtifactDocument,
      createEmptyDraft,
      openPromptDrawer,
      openContextDrawer,
      closeDrawer,
      updateDrawerDocument,
      saveDrawerDocument,
      exportProject,
      testModelProfileConnection,
      saveModelProfile,
      saveWorkbenchSettings,
      resetPromptTemplate,
      refresh: () => refresh()
    }),
    [
      archiveProject,
      closeDrawer,
      confirmCandidate,
      createEmptyDraft,
      createProject,
      deleteProject,
      discardSession,
      exportProject,
      importCorpus,
      loadArtifactDocument,
      openArtifact,
      openContextDrawer,
      openPromptDrawer,
      refresh,
      regenerateCandidate,
      resetPromptTemplate,
      restoreProject,
      saveArtifactDocument,
      saveDrawerDocument,
      saveModelProfile,
      saveWorkbenchSettings,
      testModelProfileConnection,
      selectProject,
      setActiveCandidateId,
      setActiveView,
      setModelProfileDraft,
      setProjectForm,
      setSearchQuery,
      setSettingsDraft,
      setWorkflowDraft,
      startWorkflow,
      toggleCorpus,
      updateDrawerDocument
    ]
  );

  return {
    state: {
      loading,
      error,
      notice,
      activeView,
      dashboardData,
      selectedProject,
      selectedProjectId,
      selectedCorpusIds,
      searchQuery,
      searchResults,
      activeCandidateId,
      drawer,
      projectForm,
      modelProfileDraft,
      connectionTestResult,
      settingsDraft,
      workflowDraft,
      activeJob,
      activePreviewSession,
      selectedCandidate,
      busy
    },
    actions
  };
}

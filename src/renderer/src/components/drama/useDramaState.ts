import { useState, useCallback } from "react";
import type { AppApi, DramaBible, DramaCharacterCard, DramaHook, DramaLocation, DramaPropCostume, StoryboardResult, ThreeViewResult } from "@shared/types";
import { EMPTY_DRAMA_BIBLE } from "@shared/defaults";

export interface DramaState {
  projectId: string | null;
  bible: DramaBible;
  loading: boolean;
  error: string | null;
  notice: string | null;
  activeTab: DramaTab;
  threeViewResults: Record<string, ThreeViewResult>;
  storyboards: Record<string, StoryboardResult>;
  generatingThreeView: string | null;
  generatingStoryboard: boolean;
}

export type DramaTab = "overview" | "locations" | "characters" | "props" | "hooks" | "storyboard" | "export";

export interface DramaActions {
  setActiveTab: (tab: DramaTab) => void;
  loadBible: (projectId: string) => Promise<void>;
  saveBible: () => Promise<void>;
  updateBible: (updater: (b: DramaBible) => DramaBible) => void;
  addLocation: () => void;
  updateLocation: (index: number, loc: DramaLocation) => void;
  removeLocation: (index: number) => void;
  addCharacter: () => void;
  updateCharacter: (index: number, char: DramaCharacterCard) => void;
  removeCharacter: (index: number) => void;
  addPropCostume: () => void;
  updatePropCostume: (index: number, pc: DramaPropCostume) => void;
  removePropCostume: (index: number) => void;
  addHook: () => void;
  updateHook: (index: number, hook: DramaHook) => void;
  removeHook: (index: number) => void;
  generateThreeView: (characterId: string) => Promise<void>;
  generateStoryboard: (episodeId: string, scriptText: string) => Promise<void>;
  exportAssets: (format: "png" | "zip" | "pdf") => Promise<void>;
  generateDramaBibleAI: () => Promise<void>;
}

let idCounter = 0;
function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export function useDramaState(api: AppApi): { state: DramaState; actions: DramaActions } {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [bible, setBible] = useState<DramaBible>(EMPTY_DRAMA_BIBLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DramaTab>("overview");
  const [threeViewResults, setThreeViewResults] = useState<Record<string, ThreeViewResult>>({});
  const [storyboards, setStoryboards] = useState<Record<string, StoryboardResult>>({});
  const [generatingThreeView, setGeneratingThreeView] = useState<string | null>(null);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);

  const pushNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }, []);

  const loadBible = useCallback(async (pid: string) => {
    setProjectId(pid);
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDramaBible(pid);
      setBible(data ?? EMPTY_DRAMA_BIBLE);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  const saveBible = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      await api.saveDramaBible(projectId, bible);
      pushNotice("剧本资料库已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, bible, projectId, pushNotice]);

  const updateBible = useCallback((updater: (b: DramaBible) => DramaBible) => {
    setBible((prev) => updater(prev));
  }, []);

  const addLocation = useCallback(() => {
    setBible((prev) => ({
      ...prev,
      locations: [...prev.locations, {
        id: nextId("loc"),
        name: "新场地",
        description: "",
        atmosphere: "",
        lightingNotes: "",
        episodes: []
      }]
    }));
  }, []);

  const updateLocation = useCallback((index: number, loc: DramaLocation) => {
    setBible((prev) => ({
      ...prev,
      locations: prev.locations.map((l, i) => i === index ? loc : l)
    }));
  }, []);

  const removeLocation = useCallback((index: number) => {
    setBible((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index)
    }));
  }, []);

  const addCharacter = useCallback(() => {
    setBible((prev) => ({
      ...prev,
      characters: [...prev.characters, {
        id: nextId("char"),
        name: "新角色",
        role: "",
        personality: "",
        catchphrase: "",
        costumeStyle: "",
        appearance: "",
        goal: "",
        conflict: "",
        arc: "",
        secrets: [],
        currentStatus: ""
      }]
    }));
  }, []);

  const updateCharacter = useCallback((index: number, char: DramaCharacterCard) => {
    setBible((prev) => ({
      ...prev,
      characters: prev.characters.map((c, i) => i === index ? char : c)
    }));
  }, []);

  const removeCharacter = useCallback((index: number) => {
    setBible((prev) => ({
      ...prev,
      characters: prev.characters.filter((_, i) => i !== index)
    }));
  }, []);

  const addPropCostume = useCallback(() => {
    setBible((prev) => ({
      ...prev,
      propsCostumes: [...prev.propsCostumes, {
        id: nextId("prop"),
        name: "新道具/服装",
        category: "prop",
        description: "",
        owner: "",
        scenes: []
      }]
    }));
  }, []);

  const updatePropCostume = useCallback((index: number, pc: DramaPropCostume) => {
    setBible((prev) => ({
      ...prev,
      propsCostumes: prev.propsCostumes.map((p, i) => i === index ? pc : p)
    }));
  }, []);

  const removePropCostume = useCallback((index: number) => {
    setBible((prev) => ({
      ...prev,
      propsCostumes: prev.propsCostumes.filter((_, i) => i !== index)
    }));
  }, []);

  const addHook = useCallback(() => {
    setBible((prev) => ({
      ...prev,
      hooks: [...prev.hooks, {
        id: nextId("hook"),
        episodeNumber: 1,
        hookType: "cliffhanger",
        description: "",
        status: "planted"
      }]
    }));
  }, []);

  const updateHook = useCallback((index: number, hook: DramaHook) => {
    setBible((prev) => ({
      ...prev,
      hooks: prev.hooks.map((h, i) => i === index ? hook : h)
    }));
  }, []);

  const removeHook = useCallback((index: number) => {
    setBible((prev) => ({
      ...prev,
      hooks: prev.hooks.filter((_, i) => i !== index)
    }));
  }, []);

  const generateThreeView = useCallback(async (characterId: string) => {
    if (!projectId) return;
    setGeneratingThreeView(characterId);
    setError(null);
    try {
      const result = await api.generateCharacterThreeView(projectId, characterId);
      setThreeViewResults((prev) => ({ ...prev, [characterId]: result }));
      pushNotice(`已生成 ${result.characterName} 的三视图`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingThreeView(null);
    }
  }, [api, projectId, pushNotice]);

  const generateStoryboard = useCallback(async (episodeId: string, scriptText: string) => {
    if (!projectId) return;
    setGeneratingStoryboard(true);
    setError(null);
    try {
      const result = await api.generateStoryboard({ projectId, episodeId, scriptText });
      setStoryboards((prev) => ({ ...prev, [episodeId]: result }));
      pushNotice("分镜表已生成");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingStoryboard(false);
    }
  }, [api, projectId, pushNotice]);

  const exportAssets = useCallback(async (format: "png" | "zip" | "pdf") => {
    if (!projectId) return;
    setLoading(true);
    try {
      const path = await api.exportDramaAssets({ projectId, format, includeBible: true, includeStoryboard: true });
      pushNotice(`素材已导出到 ${path}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, projectId, pushNotice]);

  const generateDramaBibleAI = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      await api.startDramaGeneration({ projectId, action: "generate-drama-bible" });
      pushNotice("AI 正在生成剧本资料库...");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, projectId, pushNotice]);

  return {
    state: {
      projectId,
      bible,
      loading,
      error,
      notice,
      activeTab,
      threeViewResults,
      storyboards,
      generatingThreeView,
      generatingStoryboard
    },
    actions: {
      setActiveTab,
      loadBible,
      saveBible,
      updateBible,
      addLocation,
      updateLocation,
      removeLocation,
      addCharacter,
      updateCharacter,
      removeCharacter,
      addPropCostume,
      updatePropCostume,
      removePropCostume,
      addHook,
      updateHook,
      removeHook,
      generateThreeView,
      generateStoryboard,
      exportAssets,
      generateDramaBibleAI
    }
  };
}

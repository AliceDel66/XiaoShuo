import { Cpu, Download, Globe, MessageSquare, Sliders } from "lucide-react";
import { useState } from "react";
import type { WorkbenchHookResult } from "./types";
import { EXPORT_FORMAT_LABELS, WORKFLOW_ACTION_LABELS } from "./view-model";
import {
  Field,
  GhostButton,
  Input,
  PanelHeader,
  PrimaryButton,
  SecondaryButton,
  Select,
  ShellPanel,
  StatusPill,
  Textarea,
  cn
} from "./ui";

export function SettingsView({ state, actions }: WorkbenchHookResult) {
  const [tab, setTab] = useState<"general" | "ai" | "prompts" | "export">("general");
  const settings = state.settingsDraft;
  const modelProfile = state.modelProfileDraft;

  return (
    <div className="flex flex-1 overflow-hidden bg-[#0f111a]">
      <aside className="flex w-72 shrink-0 flex-col border-r border-white/6 bg-[#141722] p-4">
        <h2 className="px-2 pb-4 pt-2 text-lg font-semibold text-white">首选项</h2>
        <nav className="space-y-1">
          <SettingNav active={tab === "general"} icon={<Sliders size={18} />} label="常规设置" onClick={() => setTab("general")} />
          <SettingNav active={tab === "ai"} icon={<Cpu size={18} />} label="AI 模型与接口" onClick={() => setTab("ai")} />
          <SettingNav active={tab === "prompts"} icon={<MessageSquare size={18} />} label="提示词模板" onClick={() => setTab("prompts")} />
          <SettingNav active={tab === "export"} icon={<Download size={18} />} label="导出与备份" onClick={() => setTab("export")} />
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-10">
        <div className="mx-auto max-w-4xl space-y-8">
          {tab === "general" ? (
            <>
              <ShellPanel>
                <PanelHeader eyebrow="Editor" title="编辑器偏好" subtitle="应用级设置，对所有项目生效。" />
                <div className="grid grid-cols-2 gap-4 p-6">
                  <Field label="自动保存间隔 (ms)">
                    <Input
                      type="number"
                      value={settings.editorPreferences.autoSaveMs}
                      onChange={(event) =>
                        actions.setSettingsDraft((current) => ({
                          ...current,
                          editorPreferences: {
                            ...current.editorPreferences,
                            autoSaveMs: Number(event.target.value || 0)
                          }
                        }))
                      }
                    />
                  </Field>
                  <Field label="编辑器宽度">
                    <Input
                      type="number"
                      value={settings.editorPreferences.editorWidth}
                      onChange={(event) =>
                        actions.setSettingsDraft((current) => ({
                          ...current,
                          editorPreferences: {
                            ...current.editorPreferences,
                            editorWidth: Number(event.target.value || 0)
                          }
                        }))
                      }
                    />
                  </Field>
                  <Field label="字号">
                    <Input
                      type="number"
                      value={settings.editorPreferences.fontSize}
                      onChange={(event) =>
                        actions.setSettingsDraft((current) => ({
                          ...current,
                          editorPreferences: {
                            ...current.editorPreferences,
                            fontSize: Number(event.target.value || 0)
                          }
                        }))
                      }
                    />
                  </Field>
                  <Field label="行高">
                    <Input
                      type="number"
                      step="0.1"
                      value={settings.editorPreferences.lineHeight}
                      onChange={(event) =>
                        actions.setSettingsDraft((current) => ({
                          ...current,
                          editorPreferences: {
                            ...current.editorPreferences,
                            lineHeight: Number(event.target.value || 1.8)
                          }
                        }))
                      }
                    />
                  </Field>
                </div>
              </ShellPanel>

              <ShellPanel>
                <PanelHeader eyebrow="Startup" title="启动偏好与项目默认值" subtitle="保留“恢复上次项目”和新建项目默认参数。" />
                <div className="space-y-6 p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="启动时恢复上次项目">
                      <Select
                        value={settings.startupPreferences.reopenLastProject ? "true" : "false"}
                        onChange={(event) =>
                          actions.setSettingsDraft((current) => ({
                            ...current,
                            startupPreferences: {
                              ...current.startupPreferences,
                              reopenLastProject: event.target.value === "true"
                            }
                          }))
                        }
                      >
                        <option value="true">开启</option>
                        <option value="false">关闭</option>
                      </Select>
                    </Field>
                    <Field label="默认项目目录">
                      <Input
                        value={settings.projectDefaults.defaultRootDirectory}
                        onChange={(event) =>
                          actions.setSettingsDraft((current) => ({
                            ...current,
                            projectDefaults: {
                              ...current.projectDefaults,
                              defaultRootDirectory: event.target.value
                            }
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="默认类型">
                      <Input
                        value={settings.projectDefaults.genre}
                        onChange={(event) =>
                          actions.setSettingsDraft((current) => ({
                            ...current,
                            projectDefaults: {
                              ...current.projectDefaults,
                              genre: event.target.value
                            }
                          }))
                        }
                      />
                    </Field>
                    <Field label="默认目标字数">
                      <Input
                        type="number"
                        value={settings.projectDefaults.targetWords}
                        onChange={(event) =>
                          actions.setSettingsDraft((current) => ({
                            ...current,
                            projectDefaults: {
                              ...current.projectDefaults,
                              targetWords: Number(event.target.value || 0)
                            }
                          }))
                        }
                      />
                    </Field>
                    <Field label="默认卷数">
                      <Input
                        type="number"
                        value={settings.projectDefaults.plannedVolumes}
                        onChange={(event) =>
                          actions.setSettingsDraft((current) => ({
                            ...current,
                            projectDefaults: {
                              ...current.projectDefaults,
                              plannedVolumes: Number(event.target.value || 1)
                            }
                          }))
                        }
                      />
                    </Field>
                    <Field label="默认工作流模式">
                      <Select
                        value={settings.projectDefaults.workflowMode}
                        onChange={(event) =>
                          actions.setSettingsDraft((current) => ({
                            ...current,
                            projectDefaults: {
                              ...current.projectDefaults,
                              workflowMode: event.target.value as typeof current.projectDefaults.workflowMode
                            }
                          }))
                        }
                      >
                        <option value="strict">严格流</option>
                        <option value="flexible">自由流</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="默认结局方向">
                    <Textarea
                      rows={3}
                      value={settings.projectDefaults.endingType}
                      onChange={(event) =>
                        actions.setSettingsDraft((current) => ({
                          ...current,
                          projectDefaults: {
                            ...current.projectDefaults,
                            endingType: event.target.value
                          }
                        }))
                      }
                    />
                  </Field>
                </div>
              </ShellPanel>
            </>
          ) : null}

          {tab === "ai" ? (
            <>
              <ShellPanel>
                <PanelHeader eyebrow="Provider" title="全局 Provider 设定" subtitle="AI 配置继续保存到 ModelProfile。" />
                <div className="space-y-4 p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="API Base URL">
                      <Input
                        value={modelProfile.baseUrl}
                        onChange={(event) =>
                          actions.setModelProfileDraft((current) => ({
                            ...current,
                            baseUrl: event.target.value
                          }))
                        }
                      />
                    </Field>
                    <Field label="API Key">
                      <Input
                        type="password"
                        value={modelProfile.apiKey}
                        onChange={(event) =>
                          actions.setModelProfileDraft((current) => ({
                            ...current,
                            apiKey: event.target.value
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={modelProfile.baseUrl && modelProfile.apiKey ? "success" : "warning"}>
                      {modelProfile.baseUrl && modelProfile.apiKey ? "已配置 Provider" : "尚未完整配置"}
                    </StatusPill>
                    <GhostButton>
                      <Globe size={14} className="mr-1" />
                      连通性测试稍后补充
                    </GhostButton>
                  </div>
                </div>
              </ShellPanel>

              <ShellPanel>
                <PanelHeader eyebrow="Routing" title="智能体模型路由" subtitle="按 Planner / Writer / Auditor / Embedding 分开保存。" />
                <div className="space-y-5 p-6">
                  <ModelRow
                    label="架构师 (Planner)"
                    model={modelProfile.plannerModel}
                    temperature={modelProfile.temperaturePolicy.planner}
                    onModelChange={(value) =>
                      actions.setModelProfileDraft((current) => ({
                        ...current,
                        plannerModel: value
                      }))
                    }
                    onTemperatureChange={(value) =>
                      actions.setModelProfileDraft((current) => ({
                        ...current,
                        temperaturePolicy: {
                          ...current.temperaturePolicy,
                          planner: value
                        }
                      }))
                    }
                  />
                  <ModelRow
                    label="撰稿人 (Writer)"
                    model={modelProfile.writerModel}
                    temperature={modelProfile.temperaturePolicy.writer}
                    onModelChange={(value) =>
                      actions.setModelProfileDraft((current) => ({
                        ...current,
                        writerModel: value
                      }))
                    }
                    onTemperatureChange={(value) =>
                      actions.setModelProfileDraft((current) => ({
                        ...current,
                        temperaturePolicy: {
                          ...current.temperaturePolicy,
                          writer: value
                        }
                      }))
                    }
                  />
                  <ModelRow
                    label="校对审核 (Auditor)"
                    model={modelProfile.auditorModel}
                    temperature={modelProfile.temperaturePolicy.auditor}
                    onModelChange={(value) =>
                      actions.setModelProfileDraft((current) => ({
                        ...current,
                        auditorModel: value
                      }))
                    }
                    onTemperatureChange={(value) =>
                      actions.setModelProfileDraft((current) => ({
                        ...current,
                        temperaturePolicy: {
                          ...current.temperaturePolicy,
                          auditor: value
                        }
                      }))
                    }
                  />
                  <Field label="Embedding 模型">
                    <Input
                      value={modelProfile.embeddingModel ?? ""}
                      onChange={(event) =>
                        actions.setModelProfileDraft((current) => ({
                          ...current,
                          embeddingModel: event.target.value
                        }))
                      }
                    />
                  </Field>
                </div>
              </ShellPanel>
            </>
          ) : null}

          {tab === "prompts" ? (
            <ShellPanel>
              <PanelHeader eyebrow="Templates" title="提示词模板" subtitle="按 WorkflowAction 持久化，可编辑也可重置。" />
              <div className="space-y-6 p-6">
                {Object.entries(settings.promptTemplates).map(([action, template]) => (
                  <div key={action} className="rounded-3xl border border-white/8 bg-[#0d1018] p-5">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">
                          {WORKFLOW_ACTION_LABELS[action as keyof typeof WORKFLOW_ACTION_LABELS]}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{action}</div>
                      </div>
                      <SecondaryButton onClick={() => actions.resetPromptTemplate(action as keyof typeof WORKFLOW_ACTION_LABELS)}>
                        重置默认
                      </SecondaryButton>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <Field label="System Template">
                        <Textarea
                          rows={8}
                          value={template.systemTemplate}
                          onChange={(event) =>
                            actions.setSettingsDraft((current) => ({
                              ...current,
                              promptTemplates: {
                                ...current.promptTemplates,
                                [action]: {
                                  ...current.promptTemplates[action as keyof typeof current.promptTemplates],
                                  systemTemplate: event.target.value
                                }
                              }
                            }))
                          }
                        />
                      </Field>
                      <Field label="User Template">
                        <Textarea
                          rows={8}
                          value={template.userTemplate}
                          onChange={(event) =>
                            actions.setSettingsDraft((current) => ({
                              ...current,
                              promptTemplates: {
                                ...current.promptTemplates,
                                [action]: {
                                  ...current.promptTemplates[action as keyof typeof current.promptTemplates],
                                  userTemplate: event.target.value
                                }
                              }
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </ShellPanel>
          ) : null}

          {tab === "export" ? (
            <ShellPanel>
              <PanelHeader eyebrow="Export" title="导出与备份" subtitle="复用现有导出能力，只记录偏好格式和最近导出结果。" />
              <div className="space-y-6 p-6">
                <Field label="偏好导出格式">
                  <Select
                    value={settings.exportPreferences.preferredFormat}
                    onChange={(event) =>
                      actions.setSettingsDraft((current) => ({
                        ...current,
                        exportPreferences: {
                          ...current.exportPreferences,
                          preferredFormat: event.target.value as typeof current.exportPreferences.preferredFormat
                        }
                      }))
                    }
                  >
                    {Object.entries(EXPORT_FORMAT_LABELS).map(([format, label]) => (
                      <option key={format} value={format}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(EXPORT_FORMAT_LABELS).map(([format, label]) => (
                    <SecondaryButton
                      key={format}
                      disabled={!state.selectedProject || state.busy["export-project"]}
                      onClick={() => void actions.exportProject(format as keyof typeof EXPORT_FORMAT_LABELS)}
                    >
                      导出 {label}
                    </SecondaryButton>
                  ))}
                </div>
                <div className="rounded-3xl border border-white/8 bg-[#0d1018] p-5">
                  <div className="text-sm font-semibold text-white">最近导出</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-400">
                    <div>最近格式：{settings.exportPreferences.lastExportedFormat ? EXPORT_FORMAT_LABELS[settings.exportPreferences.lastExportedFormat] : "暂无"}</div>
                    <div>最近路径：{settings.exportPreferences.lastExportedPath || "暂无"}</div>
                    <div>最近时间：{settings.exportPreferences.lastExportedAt || "暂无"}</div>
                  </div>
                </div>
              </div>
            </ShellPanel>
          ) : null}

          <div className="flex justify-end gap-3">
            <GhostButton
              onClick={() =>
                actions.setSettingsDraft(() => state.dashboardData?.settings ?? state.settingsDraft)
              }
            >
              恢复本次加载值
            </GhostButton>
            {tab === "ai" ? (
              <PrimaryButton disabled={state.busy["save-model-profile"]} onClick={() => void actions.saveModelProfile()}>
                {state.busy["save-model-profile"] ? "保存中..." : "保存 AI 配置"}
              </PrimaryButton>
            ) : (
              <PrimaryButton disabled={state.busy["save-settings"]} onClick={() => void actions.saveWorkbenchSettings()}>
                {state.busy["save-settings"] ? "保存中..." : "保存工作台设置"}
              </PrimaryButton>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SettingNav({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
        active ? "bg-cyan-500/10 text-cyan-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ModelRow({
  label,
  model,
  temperature,
  onModelChange,
  onTemperatureChange
}: {
  label: string;
  model: string;
  temperature: number;
  onModelChange: (value: string) => void;
  onTemperatureChange: (value: number) => void;
}) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1fr_280px]">
      <div>
        <div className="text-sm font-semibold text-slate-200">{label}</div>
        <div className="mt-1 text-xs text-slate-500">不同工作流阶段可以独立指定模型和温度。</div>
      </div>
      <div className="space-y-3">
        <Input value={model} onChange={(event) => onModelChange(event.target.value)} />
        <Field label={`温度：${temperature.toFixed(1)}`}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(event) => onTemperatureChange(Number(event.target.value))}
            className="w-full accent-cyan-400"
          />
        </Field>
      </div>
    </div>
  );
}

import { describe, expect, it, vi } from "vitest";
import type { GenerationPromptTrace, ModelProfile } from "../src/shared/types";
import { DEFAULT_MODEL_PROFILE } from "../src/shared/defaults";
import {
  AiOrchestrator,
  OpenAICompatibleAdapter,
  defaultResponseParser,
  type ChatCompletionParams,
  type ChatCompletionResult,
  type ProviderAdapter,
  type ProviderConnection
} from "../src/main/services/ai-orchestrator";

function stubProfile(overrides: Partial<ModelProfile> = {}): ModelProfile {
  return {
    ...DEFAULT_MODEL_PROFILE,
    baseUrl: "https://api.example.com/v1",
    apiKey: "sk-test-key",
    plannerModel: "gpt-test",
    writerModel: "gpt-test",
    auditorModel: "gpt-test",
    ...overrides
  };
}

function stubPromptTrace(): GenerationPromptTrace {
  return {
    systemPrompt: "你是一名助手。",
    userPrompt: "请生成测试数据。",
    referenceContext: [],
    projectContextSummary: []
  };
}

/** A fake adapter that returns canned JSON responses without network calls. */
class FakeAdapter implements ProviderAdapter {
  constructor(private readonly responseText: string = '{"result":"ok"}') {}

  async chat(_params: ChatCompletionParams, _connection: ProviderConnection): Promise<ChatCompletionResult> {
    return { text: this.responseText, finishReason: "stop" };
  }

  async embed(): Promise<number[][] | null> {
    return [[0.1, 0.2, 0.3]];
  }
}

class ErrorAdapter implements ProviderAdapter {
  constructor(private readonly message = "Simulated network error") {}

  async chat(): Promise<ChatCompletionResult> {
    throw new Error(this.message);
  }
}

class CountingAdapter extends FakeAdapter {
  readonly chat = vi.fn(async (_params: ChatCompletionParams, _connection: ProviderConnection) => {
    return { text: '{"ok":true}', finishReason: "stop" } satisfies ChatCompletionResult;
  });
}

describe("AiOrchestrator", () => {
  it("returns model source when adapter succeeds and JSON parses", async () => {
    const profile = stubProfile();
    const adapter = new FakeAdapter('{"value":42}');
    const orchestrator = new AiOrchestrator(() => Promise.resolve(profile), "allow", adapter);

    const result = await orchestrator.executeJson<{ value: number }>({
      role: "plannerModel",
      promptTrace: stubPromptTrace(),
      fallback: () => ({ value: 0 })
    });

    expect(result.source).toBe("model");
    expect(result.data.value).toBe(42);
    expect(result.fallbackReason).toBeUndefined();
  });

  it("falls back with reason when adapter throws and policy is allow", async () => {
    const profile = stubProfile();
    const adapter = new ErrorAdapter("Connection refused");
    const orchestrator = new AiOrchestrator(() => Promise.resolve(profile), "allow", adapter);

    const result = await orchestrator.executeJson<{ value: number }>({
      role: "plannerModel",
      promptTrace: stubPromptTrace(),
      fallback: () => ({ value: -1 })
    });

    expect(result.source).toBe("fallback");
    expect(result.data.value).toBe(-1);
    expect(result.fallbackReason).toContain("Connection refused");
  });

  it("throws when adapter fails and policy is deny", async () => {
    const profile = stubProfile();
    const adapter = new ErrorAdapter("Service unavailable");
    const orchestrator = new AiOrchestrator(() => Promise.resolve(profile), "deny", adapter);

    await expect(
      orchestrator.executeJson<{ value: number }>({
        role: "plannerModel",
        promptTrace: stubPromptTrace(),
        fallback: () => ({ value: 0 })
      })
    ).rejects.toThrow(/deny/);
  });

  it("falls back with reason when model is not configured", async () => {
    const profile = stubProfile({ plannerModel: "" });
    const adapter = new FakeAdapter();
    const orchestrator = new AiOrchestrator(() => Promise.resolve(profile), "allow", adapter);

    const result = await orchestrator.executeJson<unknown>({
      role: "plannerModel",
      promptTrace: stubPromptTrace(),
      fallback: () => ({ empty: true })
    });

    expect(result.source).toBe("fallback");
    expect(result.fallbackReason).toContain("模型未配置");
  });

  it("throws on unconfigured model when policy is deny", async () => {
    const profile = stubProfile({ baseUrl: "" });
    const orchestrator = new AiOrchestrator(() => Promise.resolve(profile), "deny");

    await expect(
      orchestrator.executeJson<unknown>({
        role: "plannerModel",
        promptTrace: stubPromptTrace(),
        fallback: () => ({})
      })
    ).rejects.toThrow(/deny/);
  });

  it("falls back when model response is not valid JSON", async () => {
    const profile = stubProfile();
    const adapter = new FakeAdapter("This is not JSON at all");
    const orchestrator = new AiOrchestrator(() => Promise.resolve(profile), "allow", adapter);

    const result = await orchestrator.executeJson<unknown>({
      role: "writerModel",
      promptTrace: stubPromptTrace(),
      fallback: () => ({ fallbackUsed: true })
    });

    expect(result.source).toBe("fallback");
    expect(result.fallbackReason).toContain("Failed to parse");
  });

  it("extracts JSON from markdown-wrapped response", async () => {
    const profile = stubProfile();
    const adapter = new FakeAdapter('Here is the result:\n```json\n{"nested": true}\n```\n');
    const orchestrator = new AiOrchestrator(() => Promise.resolve(profile), "allow", adapter);

    const result = await orchestrator.executeJson<{ nested: boolean }>({
      role: "plannerModel",
      promptTrace: stubPromptTrace(),
      fallback: () => ({ nested: false })
    });

    expect(result.source).toBe("model");
    expect(result.data.nested).toBe(true);
  });

  it("accepts a custom response parser", async () => {
    const profile = stubProfile();
    const adapter = new FakeAdapter("CUSTOM|hello");
    const customParser = {
      extractJson<T>(text: string): T | null {
        if (text.startsWith("CUSTOM|")) {
          return { parsed: text.slice(7) } as T;
        }
        return null;
      }
    };
    const orchestrator = new AiOrchestrator(() => Promise.resolve(profile), "allow", adapter, customParser);

    const result = await orchestrator.executeJson<{ parsed: string }>({
      role: "plannerModel",
      promptTrace: stubPromptTrace(),
      fallback: () => ({ parsed: "fallback" })
    });

    expect(result.source).toBe("model");
    expect(result.data.parsed).toBe("hello");
  });

  it("tests connection across chat roles and reuses repeated model probes", async () => {
    const profile = stubProfile({
      plannerModel: "gpt-shared",
      writerModel: "gpt-shared",
      auditorModel: "gpt-auditor"
    });
    const adapter = new CountingAdapter();
    const orchestrator = new AiOrchestrator(() => Promise.resolve(profile), "allow", adapter);

    const result = await orchestrator.testConnection(profile);

    expect(result.ok).toBe(true);
    expect(result.checks.find((check) => check.target === "planner")?.status).toBe("success");
    expect(result.checks.find((check) => check.target === "writer")?.status).toBe("success");
    expect(result.checks.find((check) => check.target === "auditor")?.status).toBe("success");
    expect(result.checks.find((check) => check.target === "embedding")?.status).toBe("skipped");
    expect(adapter.chat).toHaveBeenCalledTimes(2);
  });

  it("surfaces provider configuration errors in connection tests", async () => {
    const orchestrator = new AiOrchestrator(() => Promise.resolve(DEFAULT_MODEL_PROFILE), "allow", new FakeAdapter());

    const result = await orchestrator.testConnection({
      ...DEFAULT_MODEL_PROFILE,
      baseUrl: "",
      apiKey: ""
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual([
      expect.objectContaining({
        target: "provider",
        status: "failed"
      })
    ]);
  });
});

describe("defaultResponseParser", () => {
  it("parses plain JSON", () => {
    expect(defaultResponseParser.extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON array", () => {
    expect(defaultResponseParser.extractJson("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("extracts JSON from surrounding text", () => {
    const text = 'Here is the data:\n{"key":"value"}\nDone.';
    expect(defaultResponseParser.extractJson(text)).toEqual({ key: "value" });
  });

  it("returns null for non-JSON text", () => {
    expect(defaultResponseParser.extractJson("No JSON here")).toBeNull();
  });
});

describe("OpenAICompatibleAdapter", () => {
  it("is exported and implements ProviderAdapter interface", () => {
    const adapter = new OpenAICompatibleAdapter();
    expect(typeof adapter.chat).toBe("function");
    expect(typeof adapter.embed).toBe("function");
  });
});

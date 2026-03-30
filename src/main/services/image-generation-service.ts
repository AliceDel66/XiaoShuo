import type { DramaCharacterCard, ThreeViewImages, ThreeViewResult } from "../../shared/types";

export interface ImageGenerationConfig {
  provider: "openai" | "custom";
  apiUrl: string;
  apiKey: string;
  model: string;
}

const DEFAULT_THREE_VIEW_SUFFIX =
  "三视图，正面，侧面，背面，同一个人，白底，角色设计图，全身，高质量，细节丰富";

export class ImageGenerationService {
  private config: ImageGenerationConfig | null = null;

  configure(config: ImageGenerationConfig): void {
    this.config = config;
  }

  buildCharacterPrompt(character: DramaCharacterCard): string {
    const parts = [
      character.appearance,
      `服装风格：${character.costumeStyle}`,
      `性格特征：${character.personality}`,
      DEFAULT_THREE_VIEW_SUFFIX
    ];
    return parts.filter(Boolean).join("，");
  }

  async generateThreeView(character: DramaCharacterCard): Promise<ThreeViewResult> {
    const prompt = this.buildCharacterPrompt(character);

    if (!this.config || !this.config.apiKey) {
      return this.mockThreeView(character, prompt);
    }

    try {
      const images = await this.callImageApi(prompt);
      return {
        characterId: character.id,
        characterName: character.name,
        images,
        prompt,
        generatedAt: new Date().toISOString()
      };
    } catch {
      return this.mockThreeView(character, prompt);
    }
  }

  private async callImageApi(prompt: string): Promise<ThreeViewImages> {
    if (!this.config) throw new Error("Image generation not configured");

    const { apiUrl, apiKey, model } = this.config;

    const views: Array<{ key: keyof ThreeViewImages; suffix: string }> = [
      { key: "front", suffix: "正面视图" },
      { key: "side", suffix: "侧面视图" },
      { key: "back", suffix: "背面视图" }
    ];

    const images: ThreeViewImages = { generatedAt: new Date().toISOString() };

    for (const view of views) {
      const viewPrompt = `${prompt}，${view.suffix}`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          prompt: viewPrompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        })
      });

      if (!response.ok) {
        throw new Error(`Image API error: ${response.status}`);
      }

      const data = (await response.json()) as { data: Array<{ b64_json?: string; url?: string }> };
      const imageData = data.data?.[0];
      if (imageData?.b64_json) {
        (images as Record<string, string>)[view.key] = `data:image/png;base64,${imageData.b64_json}`;
      } else if (imageData?.url) {
        (images as Record<string, string>)[view.key] = imageData.url;
      }
    }

    return images;
  }

  private mockThreeView(character: DramaCharacterCard, prompt: string): ThreeViewResult {
    return {
      characterId: character.id,
      characterName: character.name,
      images: {
        front: "",
        side: "",
        back: "",
        generatedAt: new Date().toISOString()
      },
      prompt,
      generatedAt: new Date().toISOString()
    };
  }
}

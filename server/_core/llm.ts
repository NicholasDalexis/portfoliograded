/**
 * LLM wrapper backed by the official Anthropic SDK (Claude Opus 4.8).
 *
 * This preserves the exact `invokeLLM` call shape the audit engine already
 * uses (OpenAI-style `messages` + `response_format: json_schema`) so the
 * engine code does not need to change. Internally it translates to Anthropic's
 * Messages API and forces JSON output via a tool-call, which is the most
 * reliable way to get strict structured output from Claude.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};
export type MessageContent = string | TextContent | ImageContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
  max_tokens?: number;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  temperature?: number;
};

// Mirrors the OpenAI-style result shape the audit engine reads:
// response.choices?.[0]?.message?.content
export type InvokeResult = {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  }
  return _client;
}

function textFromContent(content: MessageContent | MessageContent[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((p) => (typeof p === "string" ? p : p.type === "text" ? p.text : ""))
    .filter(Boolean)
    .join("\n");
}

/**
 * Bounded, JSON-reliable call to Claude Opus 4.8.
 *
 * When a json_schema response_format is supplied, we expose a single tool whose
 * input_schema is that schema and force the model to call it — guaranteeing the
 * returned content parses against the schema.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const { messages, responseFormat, response_format } = params;
  const maxTokens = params.maxTokens ?? params.max_tokens ?? 4096;
  const temperature = params.temperature ?? 0.3;

  // Anthropic takes `system` as a top-level string, not a message role.
  const systemPrompt = messages
    .filter((m) => m.role === "system")
    .map((m) => textFromContent(m.content))
    .join("\n\n");

  const turns = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: textFromContent(m.content),
    }));

  const format = responseFormat || response_format;
  const wantsStructured =
    format?.type === "json_schema" && Boolean(format.json_schema?.schema);

  const requestBase = {
    model: ENV.anthropicModel,
    max_tokens: maxTokens,
    temperature,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: turns,
  };

  let outputText = "";
  let usage: InvokeResult["usage"];

  if (wantsStructured && format.type === "json_schema") {
    const schema = format.json_schema.schema as Record<string, unknown>;
    const toolName = format.json_schema.name || "structured_output";

    const response = await client().messages.create({
      ...requestBase,
      tools: [
        {
          name: toolName,
          description:
            "Return the result strictly matching the provided JSON schema.",
          input_schema: schema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: toolName },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    outputText = toolUse ? JSON.stringify(toolUse.input) : "";
    usage = {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    };
  } else {
    const response = await client().messages.create(requestBase);
    outputText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    usage = {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  return {
    id: `chatcmpl_${Date.now()}`,
    model: ENV.anthropicModel,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: outputText },
        finish_reason: "stop",
      },
    ],
    usage,
  };
}

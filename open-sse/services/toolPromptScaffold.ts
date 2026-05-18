/**
 * Tool Prompt Scaffolding: Enables models without native tool support to use tools
 * via prompt-based JSON calling.
 *
 * When a model doesn't support native tool calling, this module:
 * 1. Converts tool definitions into human-readable JSON schema descriptions
 * 2. Injects them into the system prompt with instructions
 * 3. Parses the model's response to extract tool calls from JSON blocks
 *
 * This allows any model to call tools by returning JSON in the format:
 *   ```
 *   <TOOL_CALL>
 *   {
 *     "tool_name": "function_name",
 *     "parameters": { ... }
 *   }
 *   </TOOL_CALL>
 *   ```
 */

interface OpenAITool {
  type?: string;
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

interface ToolCallBlock {
  toolName: string;
  parameters: Record<string, unknown>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Convert OpenAI tool format to a human-readable JSON schema description
 */
function formatToolDescription(tool: OpenAITool): string {
  const func = tool.function || tool;
  const name = func.name || "unknown_tool";
  const description = func.description || "No description provided";
  const parameters = func.parameters || { type: "object", properties: {} };

  let paramDescription = "";
  if (isPlainObject(parameters) && isPlainObject(parameters.properties)) {
    const props = parameters.properties as Record<string, unknown>;
    const propEntries = Object.entries(props)
      .map(([key, prop]) => {
        if (!isPlainObject(prop)) return `  - ${key}: unknown type`;
        const propType = prop.type || "unknown";
        const propDesc = prop.description || "";
        return `  - ${key} (${propType}): ${propDesc}`;
      })
      .join("\n");

    if (propEntries) {
      paramDescription = `\nParameters:\n${propEntries}`;
    }
  }

  return `${name}\nDescription: ${description}${paramDescription}`;
}

/**
 * Generate system prompt injection for tool calling
 */
export function generateToolCallingSystemPrompt(tools: unknown[]): string {
  if (!Array.isArray(tools) || tools.length === 0) {
    return "";
  }

  const validTools = tools.filter(isPlainObject) as OpenAITool[];
  if (validTools.length === 0) {
    return "";
  }

  const toolDescriptions = validTools.map(formatToolDescription).join("\n\n");

  return `You have access to the following tools:

${toolDescriptions}

When you need to use a tool, respond with a JSON block in this exact format:
\`\`\`
<TOOL_CALL>
{
  "tool_name": "function_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
</TOOL_CALL>
\`\`\`

You can call multiple tools in sequence. Always include the <TOOL_CALL> markers and valid JSON.`;
}

/**
 * Extract tool calls from model response using regex
 * Looks for <TOOL_CALL>...</TOOL_CALL> blocks with JSON content
 */
export function extractToolCalls(responseText: string): ToolCallBlock[] {
  const toolCalls: ToolCallBlock[] = [];

  // Match <TOOL_CALL>...</TOOL_CALL> blocks
  const toolCallRegex = /<TOOL_CALL>\s*([\s\S]*?)\s*<\/TOOL_CALL>/g;
  let match;

  while ((match = toolCallRegex.exec(responseText)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const parsed = JSON.parse(jsonContent);

      if (
        parsed &&
        typeof parsed === "object" &&
        (typeof parsed.tool_name === "string" || typeof parsed.function_name === "string") &&
        isPlainObject(parsed.parameters)
      ) {
        toolCalls.push({
          toolName: parsed.tool_name || parsed.function_name,
          parameters: parsed.parameters,
        });
      }
    } catch (e) {
      // Skip malformed JSON blocks
      continue;
    }
  }

  return toolCalls;
}

/**
 * Inject tool definitions into messages for scaffolded tool calling
 * Modifies the first system message or creates one
 */
export function injectToolsIntoMessages(
  messages: Array<Record<string, unknown>>,
  tools: unknown[],
): Array<Record<string, unknown>> {
  const toolPrompt = generateToolCallingSystemPrompt(tools);

  if (!toolPrompt) {
    return messages;
  }

  const messagesCopy = [...messages];

  // Find or create system message
  let systemMessageIndex = messagesCopy.findIndex((msg) => msg.role === "system");

  if (systemMessageIndex === -1) {
    // Create system message at the beginning
    messagesCopy.unshift({
      role: "system",
      content: toolPrompt,
    });
  } else {
    // Append to existing system message
    const existingMsg = messagesCopy[systemMessageIndex];
    const existingContent = typeof existingMsg.content === "string" ? existingMsg.content : "";
    messagesCopy[systemMessageIndex] = {
      ...existingMsg,
      content: `${existingContent}\n\n${toolPrompt}`,
    };
  }

  return messagesCopy;
}

/**
 * Convert extracted tool calls to OpenAI format tool_calls in assistant message
 */
export function convertToolCallsToOpenAIFormat(
  toolCalls: ToolCallBlock[],
): Array<{ id: string; type: string; function: Record<string, unknown> }> {
  return toolCalls.map((call, index) => ({
    id: `call_${index}_${Date.now()}`,
    type: "function",
    function: {
      name: call.toolName,
      arguments: JSON.stringify(call.parameters),
    },
  }));
}

/**
 * Check if model supports native tool calling
 * Returns false for known non-native tool models
 */
export function supportsNativeTools(modelId: string): boolean {
  const normalizedModel = String(modelId || "").toLowerCase();

  // Models that don't support native tools
  const noNativeToolsPatterns = [
    "muse-spark", // Meta's Muse models use text-based responses
    "ms-web", // Microsoft models
  ];

  return !noNativeToolsPatterns.some(
    (pattern) =>
      normalizedModel === pattern ||
      normalizedModel.includes(`/${pattern}`) ||
      normalizedModel.endsWith(pattern),
  );
}

/**
 * Process response with tool extraction and conversion
 * Returns modified content with tool calls extracted
 */
export function processScaffoldedToolResponse(responseText: string): {
  contentWithoutTools: string;
  toolCalls: ToolCallBlock[];
} {
  const toolCalls = extractToolCalls(responseText);

  // Remove tool call blocks from content for display
  const contentWithoutTools = responseText
    .replace(/<TOOL_CALL>\s*([\s\S]*?)\s*<\/TOOL_CALL>/g, "")
    .trim();

  return {
    contentWithoutTools,
    toolCalls,
  };
}

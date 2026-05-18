/**
 * Tests for Tool Prompt Scaffolding
 * Verifies that models without native tool support can use tools via prompt scaffolding
 */

import { describe, it, expect } from "vitest";
import {
  generateToolCallingSystemPrompt,
  extractToolCalls,
  injectToolsIntoMessages,
  convertToolCallsToOpenAIFormat,
  processScaffoldedToolResponse,
  supportsNativeTools,
} from "./toolPromptScaffold";

describe("Tool Prompt Scaffolding", () => {
  describe("generateToolCallingSystemPrompt", () => {
    it("should generate system prompt for tools", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "search_web",
            description: "Search the web for information",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" },
                limit: { type: "number", description: "Number of results" },
              },
              required: ["query"],
            },
          },
        },
      ];

      const prompt = generateToolCallingSystemPrompt(tools);

      expect(prompt).toContain("search_web");
      expect(prompt).toContain("Search the web for information");
      expect(prompt).toContain("<TOOL_CALL>");
      expect(prompt).toContain("</TOOL_CALL>");
      expect(prompt).toContain('"tool_name"');
      expect(prompt).toContain('"parameters"');
    });

    it("should return empty string for empty tools array", () => {
      const prompt = generateToolCallingSystemPrompt([]);
      expect(prompt).toBe("");
    });

    it("should handle tools without descriptions", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "simple_tool",
          },
        },
      ];

      const prompt = generateToolCallingSystemPrompt(tools);
      expect(prompt).toContain("simple_tool");
      expect(prompt).toContain("<TOOL_CALL>");
    });
  });

  describe("extractToolCalls", () => {
    it("should extract single tool call from response", () => {
      const response = `Here's the result:
<TOOL_CALL>
{
  "tool_name": "search_web",
  "parameters": {
    "query": "OpenAI news"
  }
}
</TOOL_CALL>
That's what I found.`;

      const toolCalls = extractToolCalls(response);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe("search_web");
      expect(toolCalls[0].parameters.query).toBe("OpenAI news");
    });

    it("should extract multiple tool calls from response", () => {
      const response = `Let me search for information.
<TOOL_CALL>
{
  "tool_name": "search_web",
  "parameters": {
    "query": "Python tutorial"
  }
}
</TOOL_CALL>
Now let me calculate something:
<TOOL_CALL>
{
  "tool_name": "calculator",
  "parameters": {
    "operation": "add",
    "a": 5,
    "b": 3
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);

      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].toolName).toBe("search_web");
      expect(toolCalls[1].toolName).toBe("calculator");
      expect(toolCalls[1].parameters.operation).toBe("add");
    });

    it("should handle malformed JSON gracefully", () => {
      const response = `This has invalid JSON:
<TOOL_CALL>
{
  "tool_name": "search_web",
  "parameters": {
    "query": "invalid json
}
</TOOL_CALL>
And a valid one:
<TOOL_CALL>
{
  "tool_name": "calculator",
  "parameters": {
    "a": 1
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);

      // Should only extract the valid one
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe("calculator");
    });

    it("should return empty array if no tool calls found", () => {
      const response = "This is just a regular response without any tool calls.";
      const toolCalls = extractToolCalls(response);

      expect(toolCalls).toHaveLength(0);
    });

    it("should support function_name as alternative to tool_name", () => {
      const response = `<TOOL_CALL>
{
  "function_name": "my_function",
  "parameters": {
    "arg": "value"
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe("my_function");
    });
  });

  describe("injectToolsIntoMessages", () => {
    it("should inject tools into existing system message", () => {
      const messages = [
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content: "Help me search for something",
        },
      ];

      const tools = [
        {
          type: "function",
          function: {
            name: "search_web",
            description: "Search the web",
          },
        },
      ];

      const result = injectToolsIntoMessages(messages, tools);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("system");
      expect(String(result[0].content)).toContain("search_web");
      expect(String(result[0].content)).toContain("You are a helpful assistant.");
      expect(result[1].role).toBe("user");
    });

    it("should create system message if none exists", () => {
      const messages = [
        {
          role: "user",
          content: "Hello",
        },
      ];

      const tools = [
        {
          type: "function",
          function: {
            name: "test_tool",
            description: "A test tool",
          },
        },
      ];

      const result = injectToolsIntoMessages(messages, tools);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("system");
      expect(String(result[0].content)).toContain("test_tool");
      expect(result[1].role).toBe("user");
    });

    it("should not modify messages if no tools provided", () => {
      const messages = [
        {
          role: "user",
          content: "Hello",
        },
      ];

      const result = injectToolsIntoMessages(messages, []);

      expect(result).toEqual(messages);
    });
  });

  describe("convertToolCallsToOpenAIFormat", () => {
    it("should convert tool calls to OpenAI format", () => {
      const toolCalls = [
        {
          toolName: "search_web",
          parameters: {
            query: "AI news",
            limit: 5,
          },
        },
      ];

      const result = convertToolCallsToOpenAIFormat(toolCalls);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("function");
      expect(result[0].function.name).toBe("search_web");
      expect(JSON.parse(result[0].function.arguments as string)).toEqual({
        query: "AI news",
        limit: 5,
      });
      expect(result[0].id).toMatch(/^call_/);
    });

    it("should generate unique IDs for multiple calls", () => {
      const toolCalls = [
        { toolName: "func1", parameters: {} },
        { toolName: "func2", parameters: {} },
      ];

      const result = convertToolCallsToOpenAIFormat(toolCalls);

      expect(result[0].id).not.toBe(result[1].id);
    });
  });

  describe("processScaffoldedToolResponse", () => {
    it("should extract tools and clean content", () => {
      const response = `Let me search for you:
<TOOL_CALL>
{
  "tool_name": "search_web",
  "parameters": {
    "query": "AI developments"
  }
}
</TOOL_CALL>

I found some interesting results!`;

      const result = processScaffoldedToolResponse(response);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe("search_web");
      expect(result.contentWithoutTools).not.toContain("<TOOL_CALL>");
      expect(result.contentWithoutTools).toContain("found some interesting results");
    });

    it("should return empty tool calls if none found", () => {
      const response = "Just a regular response";

      const result = processScaffoldedToolResponse(response);

      expect(result.toolCalls).toHaveLength(0);
      expect(result.contentWithoutTools).toBe("Just a regular response");
    });
  });

  describe("supportsNativeTools", () => {
    it("should return false for muse-spark models", () => {
      expect(supportsNativeTools("muse-spark")).toBe(false);
      expect(supportsNativeTools("provider/muse-spark")).toBe(false);
      expect(supportsNativeTools("muse-spark-thinking")).toBe(false);
    });

    it("should return false for ms-web models", () => {
      expect(supportsNativeTools("ms-web")).toBe(false);
      expect(supportsNativeTools("provider/ms-web")).toBe(false);
    });

    it("should return true for models that support native tools", () => {
      expect(supportsNativeTools("gpt-4")).toBe(true);
      expect(supportsNativeTools("claude-3-opus")).toBe(true);
      expect(supportsNativeTools("gemini-pro")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(supportsNativeTools("MUSE-SPARK")).toBe(false);
      expect(supportsNativeTools("Ms-Web")).toBe(false);
    });
  });

  describe("Integration: Full workflow", () => {
    it("should handle complete tool calling workflow", () => {
      // 1. Prepare messages with tool injection
      const originalMessages = [
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content: "Search for information about TypeScript",
        },
      ];

      const tools = [
        {
          type: "function",
          function: {
            name: "search_web",
            description: "Search the web for information",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" },
              },
            },
          },
        },
      ];

      // Inject tools into messages
      const enhancedMessages = injectToolsIntoMessages(originalMessages, tools);
      expect(enhancedMessages).toHaveLength(2);
      expect(String(enhancedMessages[0].content)).toContain("search_web");

      // 2. Simulate model response with tool call
      const modelResponse = `I'll search for TypeScript information.

<TOOL_CALL>
{
  "tool_name": "search_web",
  "parameters": {
    "query": "TypeScript programming language"
  }
}
</TOOL_CALL>

Let me get those results for you.`;

      // 3. Extract and convert tool calls
      const { contentWithoutTools, toolCalls } = processScaffoldedToolResponse(modelResponse);
      expect(toolCalls).toHaveLength(1);
      expect(contentWithoutTools).not.toContain("<TOOL_CALL>");

      // 4. Convert to OpenAI format
      const openAIToolCalls = convertToolCallsToOpenAIFormat(toolCalls);
      expect(openAIToolCalls).toHaveLength(1);
      expect(openAIToolCalls[0].type).toBe("function");
      expect(openAIToolCalls[0].function.name).toBe("search_web");

      // 5. Verify model support detection
      expect(supportsNativeTools("muse-spark")).toBe(false);
      expect(supportsNativeTools("gpt-4")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle nested JSON in parameters", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "call_api",
  "parameters": {
    "config": {
      "nested": {
        "deep": "value"
      }
    }
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters.config.nested.deep).toBe("value");
    });

    it("should handle empty parameters", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "no_args_function",
  "parameters": {}
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters).toEqual({});
    });

    it("should handle tool calls with special characters in names", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "search_web_v2",
  "parameters": {
    "query": "special chars: @#$%"
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe("search_web_v2");
      expect(toolCalls[0].parameters.query).toContain("special chars");
    });

    it("should handle whitespace variations in markers", () => {
      const response = `<TOOL_CALL>

{
  "tool_name": "test",
  "parameters": {}
}

</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe("test");
    });
  });
});

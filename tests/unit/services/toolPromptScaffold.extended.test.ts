/**
 * Extended Tool Prompt Scaffolding Tests
 * Heavy testing of extraction and detection algorithms
 */

import { describe, it, expect } from "vitest";
import {
  extractToolCalls,
  supportsNativeTools,
  processScaffoldedToolResponse,
  generateToolCallingSystemPrompt,
  injectToolsIntoMessages,
} from "./open-sse/services/toolPromptScaffold";

describe("🧪 HEAVY TESTING - Tool Prompt Scaffolding", () => {
  
  describe("Extraction Algorithm - Stress Tests", () => {
    
    it("should handle massive response with 50+ tool calls", () => {
      let response = "Starting process...\n";
      for (let i = 0; i < 50; i++) {
        response += `<TOOL_CALL>
{"tool_name": "tool_${i}", "parameters": {"id": ${i}}}
</TOOL_CALL>\n`;
      }
      response += "Done!";

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(50);
      expect(toolCalls[0].toolName).toBe("tool_0");
      expect(toolCalls[49].toolName).toBe("tool_49");
      expect(toolCalls[25].parameters.id).toBe(25);
    });

    it("should handle rapid-fire tool calls without spacing", () => {
      const response = `<TOOL_CALL>{"tool_name":"a","parameters":{}}
</TOOL_CALL><TOOL_CALL>{"tool_name":"b","parameters":{}}
</TOOL_CALL><TOOL_CALL>{"tool_name":"c","parameters":{}}
</TOOL_CALL>`;
      
      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(3);
      expect(toolCalls.map(t => t.toolName)).toEqual(["a", "b", "c"]);
    });

    it("should extract deeply nested JSON structures", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "complex",
  "parameters": {
    "level1": {
      "level2": {
        "level3": {
          "level4": {
            "level5": {
              "value": "deep"
            }
          }
        }
      }
    }
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters.level1.level2.level3.level4.level5.value).toBe("deep");
    });

    it("should handle arrays in parameters", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "batch_process",
  "parameters": {
    "items": [1, 2, 3, 4, 5],
    "tags": ["a", "b", "c"],
    "nested": [{"id": 1}, {"id": 2}]
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters.items).toEqual([1, 2, 3, 4, 5]);
      expect(toolCalls[0].parameters.tags).toEqual(["a", "b", "c"]);
      expect(toolCalls[0].parameters.nested[0].id).toBe(1);
    });

    it("should handle unicode characters in parameters", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "translate",
  "parameters": {
    "text": "Hello 世界 🌍 مرحبا мир",
    "emoji": "🚀🎉✨💯",
    "special": "ñ é ü ö ß"
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters.text).toContain("世界");
      expect(toolCalls[0].parameters.emoji).toContain("🚀");
      expect(toolCalls[0].parameters.special).toContain("ñ");
    });

    it("should handle very long string parameters (10KB+)", () => {
      const longString = "x".repeat(10000);
      const response = `<TOOL_CALL>
{
  "tool_name": "process_text",
  "parameters": {
    "content": "${longString}"
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters.content).toHaveLength(10000);
    });

    it("should handle escaped quotes and special JSON chars", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "search",
  "parameters": {
    "query": "He said \\"hello\\"",
    "path": "C:\\\\Users\\\\name\\\\file.txt",
    "json": "{\\"nested\\": \\"value\\"}"
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters.query).toContain('He said "hello"');
      expect(toolCalls[0].parameters.path).toContain("\\");
    });

    it("should skip malformed but continue with valid calls", () => {
      const response = `
Valid start:
<TOOL_CALL>{"tool_name": "first", "parameters": {"x": 1}}</TOOL_CALL>

Broken JSON:
<TOOL_CALL>{"tool_name": "broken", "parameters": {incomplete}</TOOL_CALL>

Missing tool_name:
<TOOL_CALL>{"parameters": {"x": 1}}</TOOL_CALL>

Another valid:
<TOOL_CALL>{"tool_name": "second", "parameters": {"y": 2}}</TOOL_CALL>

Missing parameters:
<TOOL_CALL>{"tool_name": "no_params"}</TOOL_CALL>

Final valid:
<TOOL_CALL>{"tool_name": "third", "parameters": {"z": 3}}</TOOL_CALL>
`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(3);
      expect(toolCalls[0].toolName).toBe("first");
      expect(toolCalls[1].toolName).toBe("second");
      expect(toolCalls[2].toolName).toBe("third");
    });

    it("should handle mixed valid formats (tool_name vs function_name)", () => {
      const response = `
<TOOL_CALL>{"tool_name": "func1", "parameters": {}}</TOOL_CALL>
<TOOL_CALL>{"function_name": "func2", "parameters": {}}</TOOL_CALL>
<TOOL_CALL>{"tool_name": "func3", "parameters": {}}</TOOL_CALL>
`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(3);
      expect(toolCalls.map(t => t.toolName)).toEqual(["func1", "func2", "func3"]);
    });

    it("should handle TOOL_CALL blocks with extra whitespace variations", () => {
      const response = `
<TOOL_CALL>
{
  "tool_name": "a",
  "parameters": {}
}
</TOOL_CALL>

<  TOOL_CALL  >
{"tool_name": "b", "parameters": {}}
<  /TOOL_CALL  >

<TOOL_CALL>{
  "tool_name": "c",
  "parameters": {}
}</TOOL_CALL>
`;

      // Note: This tests how strict the regex is
      const toolCalls = extractToolCalls(response);
      // First one will match, but the extra spaces in markers might not
      expect(toolCalls.length).toBeGreaterThanOrEqual(1);
      expect(toolCalls[0].toolName).toBe("a");
    });

    it("should handle TOOL_CALL inside TOOL_CALL (escaped)", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "meta_tool",
  "parameters": {
    "instruction": "<TOOL_CALL>{nested}</TOOL_CALL>"
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters.instruction).toContain("<TOOL_CALL>");
    });

    it("should handle numbers with scientific notation", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "calculate",
  "parameters": {
    "large": 1.23e10,
    "small": 4.56e-8,
    "negative": -7.89e5
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters.large).toBe(1.23e10);
      expect(toolCalls[0].parameters.small).toBe(4.56e-8);
    });

    it("should handle boolean and null values", () => {
      const response = `<TOOL_CALL>
{
  "tool_name": "conditional",
  "parameters": {
    "enabled": true,
    "disabled": false,
    "empty": null
  }
}
</TOOL_CALL>`;

      const toolCalls = extractToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].parameters.enabled).toBe(true);
      expect(toolCalls[0].parameters.disabled).toBe(false);
      expect(toolCalls[0].parameters.empty).toBe(null);
    });
  });

  describe("Model Detection - Comprehensive Tests", () => {
    
    it("should correctly identify all non-native models", () => {
      const nonNativeModels = [
        "muse-spark",
        "MUSE-SPARK",
        "Muse-Spark",
        "muse-spark-thinking",
        "muse-spark-contemplating",
        "ms-web",
        "MS-WEB",
        "Ms-Web",
        "provider/muse-spark",
        "provider/ms-web",
        "some-provider/muse-spark-thinking",
      ];

      nonNativeModels.forEach(model => {
        expect(supportsNativeTools(model)).toBe(false);
      });
    });

    it("should correctly identify native tool models", () => {
      const nativeModels = [
        "gpt-4",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
        "claude-3-opus",
        "claude-3-sonnet",
        "gemini-pro",
        "llama-2",
        "mistral",
        "openai/gpt-4",
        "anthropic/claude-3",
      ];

      nativeModels.forEach(model => {
        expect(supportsNativeTools(model)).toBe(true);
      });
    });

    it("should handle edge case model names", () => {
      expect(supportsNativeTools("")).toBe(true); // Empty defaults to true
      expect(supportsNativeTools("unknown-model")).toBe(true);
      expect(supportsNativeTools("muse-spark-v2")).toBe(false);
      expect(supportsNativeTools("muse-spark-123")).toBe(false);
      expect(supportsNativeTools("my-muse-spark-model")).toBe(false);
    });
  });

  describe("Response Processing - Integration Tests", () => {
    
    it("should clean content while preserving formatting", () => {
      const response = `The user asked me to search.

<TOOL_CALL>
{"tool_name": "search", "parameters": {"query": "AI"}}
</TOOL_CALL>

Here's what I found:
- Result 1
- Result 2

<TOOL_CALL>
{"tool_name": "summarize", "parameters": {"text": "results"}}
</TOOL_CALL>

Final answer with formatting.`;

      const { contentWithoutTools, toolCalls } = processScaffoldedToolResponse(response);
      
      expect(toolCalls).toHaveLength(2);
      expect(contentWithoutTools).not.toContain("<TOOL_CALL>");
      expect(contentWithoutTools).not.toContain("</TOOL_CALL>");
      expect(contentWithoutTools).toContain("The user asked");
      expect(contentWithoutTools).toContain("Final answer");
      expect(contentWithoutTools).toContain("- Result 1");
    });

    it("should handle response with only tool calls", () => {
      const response = `<TOOL_CALL>
{"tool_name": "a", "parameters": {}}
</TOOL_CALL>
<TOOL_CALL>
{"tool_name": "b", "parameters": {}}
</TOOL_CALL>`;

      const { contentWithoutTools, toolCalls } = processScaffoldedToolResponse(response);
      
      expect(toolCalls).toHaveLength(2);
      expect(contentWithoutTools.trim()).toBe("");
    });

    it("should handle response with no tool calls", () => {
      const response = "Just a regular response with no tools needed.";

      const { contentWithoutTools, toolCalls } = processScaffoldedToolResponse(response);
      
      expect(toolCalls).toHaveLength(0);
      expect(contentWithoutTools).toBe(response);
    });
  });

  describe("System Prompt Generation - Stress Tests", () => {
    
    it("should generate prompts for many tools", () => {
      const tools = Array.from({ length: 100 }, (_, i) => ({
        type: "function",
        function: {
          name: `tool_${i}`,
          description: `Tool number ${i} with some description`,
          parameters: {
            type: "object",
            properties: {
              param1: { type: "string" },
              param2: { type: "number" },
            },
          },
        },
      }));

      const prompt = generateToolCallingSystemPrompt(tools);
      
      expect(prompt).toContain("tool_0");
      expect(prompt).toContain("tool_50");
      expect(prompt).toContain("tool_99");
      expect(prompt).toContain("<TOOL_CALL>");
    });

    it("should handle tools with complex parameter descriptions", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "api_call",
            description: "Makes an API call with complex parameters",
            parameters: {
              type: "object",
              properties: {
                method: {
                  type: "string",
                  enum: ["GET", "POST", "PUT", "DELETE"],
                  description: "HTTP method",
                },
                headers: {
                  type: "object",
                  description: "HTTP headers as key-value pairs",
                },
                body: {
                  type: "object",
                  description: "Request body",
                },
              },
              required: ["method"],
            },
          },
        },
      ];

      const prompt = generateToolCallingSystemPrompt(tools);
      
      expect(prompt).toContain("api_call");
      expect(prompt).toContain("HTTP method");
    });
  });

  describe("Message Injection - Complex Scenarios", () => {
    
    it("should handle messages with tool_use blocks", () => {
      const messages = [
        {
          role: "user",
          content: "Use the search tool",
        },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I'll search for you" },
            {
              type: "tool_use",
              id: "call_123",
              name: "search",
              input: { query: "test" },
            },
          ],
        },
      ];

      const tools = [
        {
          type: "function",
          function: {
            name: "search",
            description: "Search",
          },
        },
      ];

      const result = injectToolsIntoMessages(messages as any, tools);
      expect(result.length).toBeGreaterThan(0);
      expect(String(result[0].content)).toContain("search");
    });

    it("should preserve all message roles correctly", () => {
      const messages = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
        { role: "user", content: "Help" },
      ];

      const tools = [
        {
          type: "function",
          function: { name: "help_tool", description: "Help" },
        },
      ];

      const result = injectToolsIntoMessages(messages, tools);
      
      expect(result.filter(m => m.role === "user")).toHaveLength(2);
      expect(result.filter(m => m.role === "assistant")).toHaveLength(1);
      expect(result.filter(m => m.role === "system")).toHaveLength(1);
    });
  });

  describe("Performance Stress Tests", () => {
    
    it("should process very large response quickly", () => {
      let response = "Initial content\n";
      for (let i = 0; i < 100; i++) {
        response += `Tool result ${i}\n`;
      }
      for (let i = 0; i < 20; i++) {
        response += `<TOOL_CALL>{"tool_name": "tool_${i}", "parameters": {"data": "${"x".repeat(100)}"}}</TOOL_CALL>\n`;
      }
      response += "Final content";

      const startTime = performance.now();
      const toolCalls = extractToolCalls(response);
      const endTime = performance.now();

      expect(toolCalls).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    });

    it("should handle many invalid calls without slowdown", () => {
      let response = "";
      for (let i = 0; i < 100; i++) {
        response += `<TOOL_CALL>{"invalid": "json", "data": {incomplete}</TOOL_CALL>`;
      }
      response += `<TOOL_CALL>{"tool_name": "valid", "parameters": {}}</TOOL_CALL>`;

      const startTime = performance.now();
      const toolCalls = extractToolCalls(response);
      const endTime = performance.now();

      expect(toolCalls).toHaveLength(1);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe("Real-World Scenarios", () => {
    
    it("should handle realistic research response", () => {
      const response = `Based on your query, I'll search for the latest information.

<TOOL_CALL>
{
  "tool_name": "web_search",
  "parameters": {
    "query": "artificial intelligence trends 2024",
    "language": "en",
    "num_results": 10
  }
}
</TOOL_CALL>

Now let me analyze these results and fetch more details:

<TOOL_CALL>
{
  "tool_name": "fetch_article",
  "parameters": {
    "url": "https://example.com/ai-trends",
    "extract_images": true,
    "include_metadata": true
  }
}
</TOOL_CALL>

<TOOL_CALL>
{
  "tool_name": "summarize_text",
  "parameters": {
    "text": "Full article content here...",
    "max_length": 200,
    "focus_keywords": ["AI", "ML", "trends"]
  }
}
</TOOL_CALL>

Based on the search results and analysis, here are the key findings for 2024:

1. **Large Language Models** - Continued improvement in reasoning capabilities
2. **Multimodal AI** - Better integration of text, image, and video
3. **AI Safety** - Increased focus on alignment and safety measures

Would you like me to dive deeper into any of these areas?`;

      const { contentWithoutTools, toolCalls } = processScaffoldedToolResponse(response);

      expect(toolCalls).toHaveLength(3);
      expect(toolCalls[0].toolName).toBe("web_search");
      expect(toolCalls[1].toolName).toBe("fetch_article");
      expect(toolCalls[2].toolName).toBe("summarize_text");
      
      expect(contentWithoutTools).toContain("Based on your query");
      expect(contentWithoutTools).toContain("key findings");
      expect(contentWithoutTools).toContain("Would you like");
      expect(contentWithoutTools).not.toContain("<TOOL_CALL>");
    });

    it("should handle customer support workflow", () => {
      const response = `Thank you for contacting us. Let me help you with your issue.

<TOOL_CALL>
{
  "tool_name": "lookup_customer",
  "parameters": {
    "email": "user@example.com"
  }
}
</TOOL_CALL>

<TOOL_CALL>
{
  "tool_name": "get_order_history",
  "parameters": {
    "customer_id": "cust_123",
    "limit": 5
  }
}
</TOOL_CALL>

I found your account and recent orders. Based on your profile, I can see:

<TOOL_CALL>
{
  "tool_name": "check_warranty",
  "parameters": {
    "order_id": "order_456",
    "product_sku": "PROD-789"
  }
}
</TOOL_CALL>

Your product is still under warranty. I've initiated a support ticket for you:
- Ticket ID: SUPPORT-12345
- Status: Open
- Priority: High

Our team will contact you within 24 hours.`;

      const { contentWithoutTools, toolCalls } = processScaffoldedToolResponse(response);

      expect(toolCalls).toHaveLength(3);
      expect(toolCalls[0].parameters.email).toBe("user@example.com");
      expect(contentWithoutTools).toContain("Ticket ID");
      expect(contentWithoutTools).toContain("within 24 hours");
    });
  });
});

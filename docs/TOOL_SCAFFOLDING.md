# Tool Prompt Scaffolding Implementation Guide

## Overview

Tool Prompt Scaffolding enables models that don't support native tool calling (like Muse Spark and MS-Web) to use tools through prompt-based JSON formatting. Instead of native tool APIs, models return JSON-formatted tool calls in their text responses, which are then parsed and converted to the standard OpenAI format.

## How It Works

### 1. Tool Definition Injection

When tools are provided in a request but the model doesn't support native tool calling:

```typescript
// Tools are converted to human-readable prompts
const systemPrompt = generateToolCallingSystemPrompt(tools);

// System message is injected/created with tool instructions
const messagesWithTools = injectToolsIntoMessages(messages, tools);
```

The model receives instructions like:

```
You have access to the following tools:

search_web
Description: Search the web for information
Parameters:
  - query (string): Search query
  - limit (number): Number of results

When you need to use a tool, respond with a JSON block in this exact format:
```
<TOOL_CALL>
{
  "tool_name": "function_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
</TOOL_CALL>
```
```

### 2. Response Parsing

When the model responds with tool calls in JSON format:

```typescript
const { contentWithoutTools, toolCalls } = processScaffoldedToolResponse(response);
```

The response is parsed using regex to extract `<TOOL_CALL>...</TOOL_CALL>` blocks and convert them back to OpenAI format.

### 3. Tool Call Conversion

Extracted tool calls are converted to the standard OpenAI format:

```typescript
const openAIToolCalls = convertToolCallsToOpenAIFormat(toolCalls);

// Results in:
[
  {
    id: "call_0_1234567890",
    type: "function",
    function: {
      name: "search_web",
      arguments: '{"query":"OpenAI","limit":5}'
    }
  }
]
```

## Integration Points

### Muse Spark Web Executor (`open-sse/executors/muse-spark-web.ts`)

The executor automatically:

1. **Injects tools** before sending to Meta's API:
```typescript
if (tools && tools.length > 0) {
  processedMessages = injectToolsIntoMessages(messages, tools);
}
```

2. **Parses responses** for tool calls:
```typescript
if (tools && tools.length > 0) {
  const { contentWithoutTools, toolCalls } = processScaffoldedToolResponse(parsed.content);
  if (toolCalls.length > 0) {
    parsed.toolCalls = convertToolCallsToOpenAIFormat(toolCalls);
  }
}
```

3. **Returns proper finish_reason**:
```typescript
finish_reason: toolCalls && toolCalls.length > 0 ? "tool_calls" : "stop"
```

### MS-Web Executor

`ms-web` is an alias for `muse-spark-web`, so it automatically inherits all tool scaffolding functionality.

## Supported Models

### Models with Tool Scaffolding Support
- `muse-spark` - Meta's Muse Spark model
- `muse-spark-thinking` - Thinking version
- `muse-spark-contemplating` - Deep thinking version
- `ms-web` - Microsoft Web (alias for muse-spark-web)

### Detection

Use the helper function to check if a model supports native tools:

```typescript
if (!supportsNativeTools(modelId)) {
  // Use scaffold-based tool calling
}
```

## Response Format Requirements

### Input: Tool Definitions

Standard OpenAI format:
```typescript
{
  type: "function",
  function: {
    name: "search_web",
    description: "Search the web for information",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results" }
      },
      required: ["query"]
    }
  }
}
```

### Output: Model Response with Tools

The model returns regular text with embedded tool calls:

```
Let me search for that information.

<TOOL_CALL>
{
  "tool_name": "search_web",
  "parameters": {
    "query": "TypeScript programming",
    "limit": 5
  }
}
</TOOL_CALL>

I found several results...
```

### Converted Response

Automatically converted to OpenAI format:

```json
{
  "id": "chatcmpl-meta-abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "muse-spark",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Let me search for that information.\n\nI found several results...",
      "tool_calls": [{
        "id": "call_0_1234567890",
        "type": "function",
        "function": {
          "name": "search_web",
          "arguments": "{\"query\":\"TypeScript programming\",\"limit\":5}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

## Usage Examples

### Example 1: Simple Tool Call

```typescript
const messages = [
  {
    role: "user",
    content: "Search for information about AI"
  }
];

const tools = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    }
  }
];

const response = await client.chat.completions.create({
  model: "muse-spark",
  messages,
  tools,
  tool_choice: "auto"
});

// Response will include tool_calls in the message
if (response.choices[0].finish_reason === "tool_calls") {
  const toolCalls = response.choices[0].message.tool_calls;
  // Process tool calls...
}
```

### Example 2: Multiple Tools

The scaffold format supports multiple tools:

```
<TOOL_CALL>
{"tool_name": "search_web", "parameters": {"query": "Python"}}
</TOOL_CALL>

<TOOL_CALL>
{"tool_name": "calculator", "parameters": {"operation": "add", "a": 5, "b": 3}}
</TOOL_CALL>
```

Both are extracted and converted properly.

## Edge Cases & Error Handling

### Malformed JSON

If a tool call block has malformed JSON, it's silently skipped:

```typescript
<TOOL_CALL>
{"tool_name": "broken", "parameters": {invalid json}}
</TOOL_CALL>

<TOOL_CALL>
{"tool_name": "valid", "parameters": {}}
</TOOL_CALL>
```

Only the valid call is extracted.

### Missing Parameters

Tool calls with missing `tool_name` or `parameters` are skipped:

```typescript
<TOOL_CALL>
{"parameters": {}} // Missing tool_name - skipped
</TOOL_CALL>

<TOOL_CALL>
{"tool_name": "func"} // Missing parameters - skipped
</TOOL_CALL>
```

### Whitespace Handling

The parser handles various whitespace scenarios:

```
<TOOL_CALL>
{  ... }
</TOOL_CALL>

<TOOL_CALL>

{  ...  }

</TOOL_CALL>

<TOOL_CALL>{...}</TOOL_CALL>
```

All are correctly parsed.

## Streaming Support

Streaming responses automatically include tool calls in the stream:

```
data: {"choices":[{"delta":{"role":"assistant"}}]}
data: {"choices":[{"delta":{"content":"Let me search..."}}]}
data: {"choices":[{"delta":{"tool_calls":[{...}]}}]}
data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}
```

## Performance Considerations

### Regex Matching

- Uses single-pass regex to find `<TOOL_CALL>` markers
- Efficient for typical response sizes
- O(n) complexity where n = response length

### JSON Parsing

- Only parses JSON within valid `<TOOL_CALL>` blocks
- Invalid JSON is gracefully skipped
- No blocking operations

### System Prompt Overhead

- Tool descriptions are added to system message once
- Approximately 2-3 tokens per tool parameter
- Minimal impact on context usage

## Testing

Run the comprehensive test suite:

```bash
npm test -- toolPromptScaffold.test.ts
```

Tests cover:
- Tool prompt generation
- Multiple tool extraction
- Malformed JSON handling
- Message injection
- Format conversion
- Edge cases with special characters
- Integration workflows

## Migration Guide

### For Existing Tool Integrations

No changes needed! The scaffolding is transparent:

1. Tools are automatically scaffolded for non-native models
2. Responses are automatically converted back to OpenAI format
3. The API interface remains identical

### For Custom Implementations

If you're building a custom integration:

```typescript
import {
  injectToolsIntoMessages,
  processScaffoldedToolResponse,
  supportsNativeTools,
} from "@omniroute/open-sse/services/toolPromptScaffold.ts";

// Before sending to model
if (!supportsNativeTools(model)) {
  messages = injectToolsIntoMessages(messages, tools);
}

// After receiving response
if (!supportsNativeTools(model) && tools && tools.length > 0) {
  const { contentWithoutTools, toolCalls } = processScaffoldedToolResponse(response);
  // Convert tool calls to your format
}
```

## Future Improvements

Potential enhancements:

1. **Alternative markers**: Support different tool call formats (XML, HTML, etc.)
2. **Validation**: Optional JSON Schema validation of parameters
3. **Caching**: Cache tool prompt injections for repeated requests
4. **Metrics**: Track tool call success/failure rates
5. **Error recovery**: Automatic retry with clarification prompts

## Troubleshooting

### Tools not being called

1. Check that `tools` array is provided in the request
2. Verify model is non-native (use `supportsNativeTools()`)
3. Ensure `tool_choice` is set appropriately
4. Check system message for tool descriptions

### Tool calls not extracted

1. Verify response contains `<TOOL_CALL>` markers
2. Check JSON validity within markers
3. Ensure both `tool_name` and `parameters` are present
4. Review logs for parsing errors

### Wrong parameter values

1. Verify parameter types in tool schema
2. Check for JSON string escaping issues
3. Ensure model received full tool descriptions

## References

- OpenAI Chat Completions API: https://platform.openai.com/docs/api-reference/chat/create
- Tool definitions format: https://platform.openai.com/docs/guides/function-calling
- JSON Schema validation: https://json-schema.org/

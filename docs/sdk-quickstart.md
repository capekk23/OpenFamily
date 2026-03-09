# OpenFamily SDK Quickstart

Add AI agent governance to your agents in 3 lines of code.

## Installation

```bash
npm install @openfamily/sdk
# or
pnpm add @openfamily/sdk
```

## Prerequisites

1. A running OpenFamily instance (see [Running Locally](#running-locally))
2. An API key bound to a policy (create via the dashboard at `http://localhost:3000`)

---

## Quick Start

```typescript
import { OpenFamilyClient } from '@openfamily/sdk';

const client = new OpenFamilyClient({
  gatewayUrl: 'http://localhost:3001',
  apiKey: 'of_your_api_key_here',
});

// Start a session for your agent
const sessionId = await client.startSession('my-agent-001', {
  agentName: 'Research Bot',
});

// Intercept a tool call before executing it
const result = await client.intercept({
  sessionId,
  toolName: 'web_search',
  toolInput: { query: 'latest AI news' },
});

if (result.allowed) {
  // Safe to execute the tool
  const searchResults = await webSearch(result.toolInput.query as string);
}
```

---

## LangChain Integration

Wrap existing LangChain tools to automatically intercept every call:

```typescript
import { OpenFamilyClient, wrapTool } from '@openfamily/sdk';
import { DuckDuckGoSearch } from 'langchain/tools';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import { ChatAnthropic } from '@langchain/anthropic';

const client = new OpenFamilyClient({
  gatewayUrl: 'http://localhost:3001',
  apiKey: process.env.OPENFAMILY_API_KEY!,
});

const sessionId = await client.startSession('langchain-agent');

// Wrap all tools — that's it
const tools = [
  new DuckDuckGoSearch(),
  // ...more tools
].map(tool => wrapTool(tool, client, sessionId));

const llm = new ChatAnthropic({ model: 'claude-sonnet-4-6' });
const agent = await createReactAgent({ llm, tools });
const executor = new AgentExecutor({ agent, tools });

const result = await executor.invoke({
  input: 'What are the latest AI developments?',
});
```

When a tool call is **blocked**, `wrapTool` throws a `ToolBlockedError` that LangChain's executor handles gracefully — the agent sees an error message and can decide to try a different approach.

When a tool requires **human approval**, the interceptor holds the request open (up to 30 seconds) while a human reviews it in the OpenFamily dashboard. The agent automatically resumes when the human approves.

---

## Anthropic Native Integration

For agents using the Anthropic SDK directly with `tool_use` blocks:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { OpenFamilyClient, interceptToolUseBlocks } from '@openfamily/sdk';

const anthropic = new Anthropic();
const client = new OpenFamilyClient({
  gatewayUrl: 'http://localhost:3001',
  apiKey: process.env.OPENFAMILY_API_KEY!,
});

const sessionId = await client.startSession('anthropic-agent');

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  tools: [/* your tools */],
  messages: [{ role: 'user', content: 'Search for recent AI news' }],
});

// Intercept all tool_use blocks before executing them
const results = await interceptToolUseBlocks(response.content, client, sessionId);

// results contains allowed/blocked status for each tool call
for (const r of results) {
  if (r.allowed) {
    // execute the tool
  } else {
    console.log(`Blocked: ${r.decision} — ${r.reason}`);
  }
}
```

---

## Raw HTTP / Framework-Agnostic

```typescript
import { OpenFamilyClient, ToolBlockedError } from '@openfamily/sdk';

const client = new OpenFamilyClient({
  gatewayUrl: process.env.OPENFAMILY_GATEWAY_URL!,
  apiKey: process.env.OPENFAMILY_API_KEY!,
});

const sessionId = await client.startSession('my-agent');

async function governedToolCall(toolName: string, toolInput: Record<string, unknown>) {
  try {
    const result = await client.intercept({ sessionId, toolName, toolInput });
    return result; // proceed with tool execution
  } catch (err) {
    if (err instanceof ToolBlockedError) {
      console.log(`[${err.decision}] ${err.reason}`);
      return null; // tool was blocked — handle gracefully
    }
    throw err;
  }
}
```

---

## Policy Reference

Policies are JSON objects stored in the dashboard. Key fields:

```json
{
  "blockedTools": ["delete_file", "drop_table"],
  "allowedTools": ["web_search", "read_file"],
  "allowedDomains": ["*.wikipedia.org", "arxiv.org"],
  "useSupervisor": true,
  "requireApproval": {
    "always": false,
    "forTools": ["send_email", "execute_code"],
    "approvalTimeoutSeconds": 300,
    "timeoutBehavior": "deny"
  },
  "budgetCap": {
    "maxPerSession": 5.00,
    "maxPerCall": 0.50
  },
  "rateLimits": {
    "callsPerMinute": 10,
    "callsPerHour": 100
  }
}
```

| Field | Description |
|---|---|
| `blockedTools` | Tool names always denied, regardless of other rules |
| `allowedTools` | If set, ONLY these tools are allowed (allowlist mode) |
| `allowedDomains` | Domains allowed for HTTP tools; supports `*.example.com` wildcards |
| `useSupervisor` | Route ambiguous calls to Claude for evaluation |
| `requireApproval.forTools` | These tools require human approval before executing |
| `requireApproval.always` | Every tool call requires human approval |
| `approvalTimeoutSeconds` | Seconds to wait for human approval (default: 300) |
| `timeoutBehavior` | What to do on timeout: `"deny"` (default) or `"approve"` |
| `budgetCap.maxPerCall` | Max estimated cost per single tool call |
| `budgetCap.maxPerSession` | Max total spend for the session |

---

## Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/capekk23/OpenFamily
cd OpenFamily

# 2. Copy and fill in your env vars
cp .env.example .env
# Edit .env: set JWT_SECRET, SETTINGS_ENCRYPTION_KEY, and optionally ANTHROPIC_API_KEY

# 3. Start everything
docker compose up -d

# 4. Open the dashboard
open http://localhost:3000
# → You'll be redirected to /setup for first-run configuration
```

---

## Error Reference

| Error / Status | Meaning |
|---|---|
| `ToolBlockedError` (decision: `BLOCKED`) | Tool is in `blockedTools` or not in `allowedTools` |
| `ToolBlockedError` (decision: `DENIED_BY_SUPERVISOR`) | Supervisor AI determined the call is unsafe |
| `ToolBlockedError` (decision: `DENIED_BY_HUMAN`) | A human reviewer denied the call |
| `ToolBlockedError` (decision: `TIMED_OUT`) | Approval request expired with `timeoutBehavior: "deny"` |
| HTTP 401 | Invalid or missing API key |
| HTTP 429 | Rate limit exceeded (60 calls/min per key by default) |

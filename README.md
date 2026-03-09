# OpenFamily

**Family Link for AI Agents** — a governance and oversight platform that intercepts AI agent tool calls, enforces policies, routes edge cases to a supervisor AI, and escalates to humans for approval.

```
Agent → OpenFamily Gateway → Policy Check → APPROVE / BLOCK / Supervisor AI / Human Approval
```

## Features

- **Policy engine** — allow/block tools, domain filtering, budget caps, rate limits, human approval rules
- **Supervisor AI** — Claude evaluates borderline tool calls and decides approve / deny / escalate
- **Human approval queue** — real-time dashboard with approve/deny buttons, SSE live updates
- **Audit log** — every tool call logged with decision, reason, cost, supervisor notes
- **Multi-provider** — configure Anthropic, OpenRouter, OpenAI, or any OpenAI-compatible provider
- **SDK** — 3 lines to govern any LangChain or Anthropic agent
- **Onboarding wizard** — first-run setup: admin account + AI provider config

## Quick Start

```bash
# 1. Clone and set up env
git clone https://github.com/capekk23/OpenFamily && cd OpenFamily
cp .env.example .env
# Edit .env: set JWT_SECRET and SETTINGS_ENCRYPTION_KEY

# 2. Start everything
docker compose up -d

# 3. Open the dashboard (onboarding wizard on first run)
open http://localhost:3000
```

In the dashboard:
1. Create a policy (e.g. allow `web_search`, require approval for `send_email`)
2. Generate an API key bound to that policy
3. Connect your agent using the SDK

## SDK Usage

```bash
npm install @openfamily/sdk
```

```typescript
import { OpenFamilyClient, wrapTool } from '@openfamily/sdk';

const client = new OpenFamilyClient({
  gatewayUrl: 'http://localhost:3001',
  apiKey: 'of_your_api_key',
});

const sessionId = await client.startSession('my-agent');

// Option 1: Manual intercept
const result = await client.intercept({ sessionId, toolName: 'web_search', toolInput: { query: '...' } });

// Option 2: Wrap LangChain tools
const tools = [webSearch, fileRead].map(t => wrapTool(t, client, sessionId));
```

See [`docs/sdk-quickstart.md`](docs/sdk-quickstart.md) for the full guide.

## Architecture

| Service | Port | Purpose |
|---|---|---|
| Dashboard | 3000 | Next.js UI — policies, approvals, audit log, settings |
| API | 3002 | REST API for dashboard |
| Gateway | 3001 | Agent-facing intercept endpoint (hot path) |
| Supervisor | 3003 | Internal LLM service (Claude) |

All services share a PostgreSQL database (via Prisma) and Redis (pub-sub + BullMQ).

## Policy Example

```json
{
  "blockedTools": ["delete_file"],
  "allowedDomains": ["*.wikipedia.org", "arxiv.org"],
  "useSupervisor": true,
  "requireApproval": {
    "forTools": ["send_email"],
    "approvalTimeoutSeconds": 300,
    "timeoutBehavior": "deny"
  }
}
```

## Examples

- [`examples/langchain-research-agent.ts`](examples/langchain-research-agent.ts) — governed LangChain agent
- [`examples/anthropic-native-agent.ts`](examples/anthropic-native-agent.ts) — Anthropic SDK with tool_use interception

## Development

```bash
pnpm install
docker compose up postgres redis -d
pnpm exec prisma migrate dev --schema=prisma/schema.prisma

# Run all unit tests
pnpm test

# Typecheck all packages
pnpm typecheck

# Start all services in dev mode
pnpm dev
```

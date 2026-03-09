/**
 * OpenFamily SDK — LangChain Research Agent Example
 *
 * A simple research agent whose tools are governed by an OpenFamily policy.
 * Any tool call can be approved, blocked, routed to the supervisor AI,
 * or held for human approval — transparently, without changing the agent logic.
 *
 * Prerequisites:
 *   1. OpenFamily stack running (`docker compose up -d`)
 *   2. A policy created in the dashboard (e.g. allows web_search, requires
 *      approval for send_email, blocks delete_file)
 *   3. An API key bound to that policy
 *
 * Run:
 *   OPENFAMILY_API_KEY=of_xxx ANTHROPIC_API_KEY=sk-ant-xxx npx tsx langchain-research-agent.ts
 */

import { OpenFamilyClient, ToolBlockedError } from '@openfamily/sdk';

// ─── Simulated tools (replace with real implementations) ─────────────────────

async function webSearch(query: string): Promise<string> {
  // In production: use Tavily, SerpAPI, DuckDuckGo SDK, etc.
  return `[Simulated search results for: "${query}"]
  - Result 1: AI governance frameworks gaining traction in 2026
  - Result 2: Claude 4 released with enhanced reasoning capabilities
  - Result 3: OpenFamily adoption rises among enterprise AI teams`;
}

async function readFile(path: string): Promise<string> {
  return `[Simulated file contents of ${path}]`;
}

async function sendEmail(to: string, subject: string, body: string): Promise<string> {
  console.log(`📧 Would send email to ${to}: "${subject}"`);
  return `Email sent to ${to}`;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = {
  web_search: async (input: { query: string }) => webSearch(input.query),
  read_file: async (input: { path: string }) => readFile(input.path),
  send_email: async (input: { to: string; subject: string; body: string }) =>
    sendEmail(input.to, input.subject, input.body),
};

// ─── Main agent loop ──────────────────────────────────────────────────────────

async function main() {
  const gatewayUrl = process.env.OPENFAMILY_GATEWAY_URL ?? 'http://localhost:3001';
  const apiKey = process.env.OPENFAMILY_API_KEY;

  if (!apiKey) {
    console.error('OPENFAMILY_API_KEY is required');
    process.exit(1);
  }

  const client = new OpenFamilyClient({ gatewayUrl, apiKey });

  // Register a session for this agent run
  const sessionId = await client.startSession('research-agent-001', {
    agentName: 'Research Agent',
  });
  console.log(`✅ Session started: ${sessionId}`);

  // Simulate an agentic loop making several tool calls
  const toolCalls: Array<{ toolName: string; toolInput: Record<string, unknown> }> = [
    { toolName: 'web_search', toolInput: { query: 'latest AI governance news 2026' } },
    { toolName: 'read_file', toolInput: { path: '/workspace/report.txt' } },
    { toolName: 'send_email', toolInput: {
      to: 'team@example.com',
      subject: 'Research Summary',
      body: 'Here are the latest findings...',
    }},
  ];

  for (const call of toolCalls) {
    console.log(`\n🔧 Tool: ${call.toolName}`, JSON.stringify(call.toolInput));

    try {
      // Intercept BEFORE executing the tool
      const result = await client.intercept({
        sessionId,
        toolName: call.toolName,
        toolInput: call.toolInput,
      });

      console.log(`  ✅ ${result.decision}${result.supervisorNotes ? ` (supervisor: ${result.supervisorNotes})` : ''}`);

      // Execute the actual tool
      const toolFn = TOOLS[call.toolName as keyof typeof TOOLS];
      if (toolFn) {
        const output = await toolFn(call.toolInput as never);
        console.log(`  📤 Output: ${output.substring(0, 100)}...`);
      }
    } catch (err) {
      if (err instanceof ToolBlockedError) {
        console.log(`  ❌ ${err.decision}: ${err.reason}`);
        if (err.supervisorNotes) {
          console.log(`  💬 Supervisor notes: ${err.supervisorNotes}`);
        }
        // The agent can gracefully handle the blocked call:
        // - Try an alternative tool
        // - Inform the user
        // - Skip this step
        continue;
      }
      throw err;
    }
  }

  console.log('\n✅ Agent completed. Check the OpenFamily dashboard for the full audit log:');
  console.log('   http://localhost:3000/activity');
  console.log('   http://localhost:3000/sessions');
}

main().catch(console.error);

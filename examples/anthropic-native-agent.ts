/**
 * OpenFamily SDK — Anthropic Native Tool Use Example
 *
 * Uses the Anthropic SDK directly with tool_use blocks.
 * Every tool call is intercepted by OpenFamily before execution.
 *
 * Run:
 *   OPENFAMILY_API_KEY=of_xxx ANTHROPIC_API_KEY=sk-ant-xxx npx tsx anthropic-native-agent.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { OpenFamilyClient, ToolBlockedError } from '@openfamily/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const client = new OpenFamilyClient({
  gatewayUrl: process.env.OPENFAMILY_GATEWAY_URL ?? 'http://localhost:3001',
  apiKey: process.env.OPENFAMILY_API_KEY!,
});

// Tool definitions for Claude
const tools: Anthropic.Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web for information',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email to a recipient',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
];

// Tool implementations (replace with real ones)
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === 'web_search') {
    return `Search results for "${input.query}": AI governance is growing rapidly in 2026.`;
  }
  if (name === 'send_email') {
    return `Email sent to ${input.to}.`;
  }
  return 'Unknown tool';
}

async function runAgent(userMessage: string) {
  const sessionId = await client.startSession('anthropic-agent-001', {
    agentName: 'Anthropic Research Agent',
  });
  console.log(`Session: ${sessionId}\n`);

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  // Agentic loop
  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools,
      messages,
    });

    // Check for tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      // Final response
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        console.log('\nAgent response:', textBlock.text);
      }
      break;
    }

    // Add assistant's response to history
    messages.push({ role: 'assistant', content: response.content });

    // Intercept and execute each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      console.log(`\nTool: ${toolUse.name}`, JSON.stringify(toolUse.input));

      try {
        // Intercept BEFORE executing
        const intercept = await client.intercept({
          sessionId,
          toolName: toolUse.name,
          toolInput: toolUse.input as Record<string, unknown>,
        });

        console.log(`  ✅ ${intercept.decision}`);

        // Execute the tool
        const output = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: output });
      } catch (err) {
        if (err instanceof ToolBlockedError) {
          console.log(`  ❌ ${err.decision}: ${err.reason}`);
          // Return the blocked reason to the model so it can react
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Tool call was blocked by policy: ${err.reason}`,
            is_error: true,
          });
        } else {
          throw err;
        }
      }
    }

    // Continue the agentic loop with tool results
    messages.push({ role: 'user', content: toolResults });
  }

  console.log('\nAudit log: http://localhost:3000/activity');
}

runAgent('Search for the latest AI news and send a summary email to cto@company.com').catch(console.error);

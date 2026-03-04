import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wrapTool, LangChainToolLike } from '../adapters/LangChainAdapter.js';
import { OpenFamilyClient, ToolBlockedError } from '../OpenFamilyClient.js';

function makeTool(name = 'web_search'): LangChainToolLike {
  return {
    name,
    description: 'Search the web',
    func: vi.fn().mockResolvedValue('search result'),
  };
}

function makeClient(interceptResult: Awaited<ReturnType<OpenFamilyClient['intercept']>> | 'block'): OpenFamilyClient {
  const client = new OpenFamilyClient({ gatewayUrl: 'http://gw', apiKey: 'key' });
  client.setSessionId('sess-1');

  if (interceptResult === 'block') {
    vi.spyOn(client, 'intercept').mockRejectedValue(
      new ToolBlockedError('BLOCKED', 'tool is blocked')
    );
  } else {
    vi.spyOn(client, 'intercept').mockResolvedValue(interceptResult);
  }

  return client;
}

describe('wrapTool (LangChainAdapter)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('calls original func when intercept approves', async () => {
    const tool = makeTool();
    const client = makeClient({ allowed: true, decision: 'APPROVED', reason: 'ok' });
    const wrapped = wrapTool(tool, client);

    const result = await wrapped.func('find me something');
    expect(result).toBe('search result');
    expect(tool.func).toHaveBeenCalledWith('find me something');
  });

  it('throws ToolBlockedError when intercept blocks', async () => {
    const tool = makeTool();
    const client = makeClient('block');
    const wrapped = wrapTool(tool, client);

    await expect(wrapped.func('find me something')).rejects.toThrow(ToolBlockedError);
    expect(tool.func).not.toHaveBeenCalled();
  });

  it('passes tool name to intercept', async () => {
    const tool = makeTool('send_email');
    const client = makeClient({ allowed: true, decision: 'APPROVED', reason: 'ok' });
    const wrapped = wrapTool(tool, client);

    await wrapped.func({ to: 'a@b.com', subject: 'hi' });
    expect(client.intercept).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'send_email' })
    );
  });

  it('wraps string input as { input: string }', async () => {
    const tool = makeTool();
    const client = makeClient({ allowed: true, decision: 'APPROVED', reason: 'ok' });
    const wrapped = wrapTool(tool, client);

    await wrapped.func('hello world');
    expect(client.intercept).toHaveBeenCalledWith(
      expect.objectContaining({ toolInput: { input: 'hello world' } })
    );
  });

  it('passes object input directly', async () => {
    const tool = makeTool();
    const client = makeClient({ allowed: true, decision: 'APPROVED', reason: 'ok' });
    const wrapped = wrapTool(tool, client);

    await wrapped.func({ url: 'https://example.com' });
    expect(client.intercept).toHaveBeenCalledWith(
      expect.objectContaining({ toolInput: { url: 'https://example.com' } })
    );
  });

  it('throws if no active session', async () => {
    const tool = makeTool();
    const client = new OpenFamilyClient({ gatewayUrl: 'http://gw', apiKey: 'key' });
    // no setSessionId call
    const wrapped = wrapTool(tool, client);
    await expect(wrapped.func('hello')).rejects.toThrow('no active session');
  });

  it('preserves other tool properties', () => {
    const tool = { ...makeTool(), schema: { type: 'object' }, metadata: { version: 2 } };
    const client = makeClient({ allowed: true, decision: 'APPROVED', reason: 'ok' });
    const wrapped = wrapTool(tool, client);
    expect(wrapped.schema).toEqual({ type: 'object' });
    expect(wrapped.metadata).toEqual({ version: 2 });
  });
});

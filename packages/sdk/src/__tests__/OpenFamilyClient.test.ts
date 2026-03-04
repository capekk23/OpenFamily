import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenFamilyClient, ToolBlockedError } from '../OpenFamilyClient.js';

const BASE_CONFIG = { gatewayUrl: 'http://gateway:3001', apiKey: 'of_test_key' };

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('OpenFamilyClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('startSession', () => {
    it('POSTs to /v1/sessions and returns sessionId', async () => {
      global.fetch = mockFetch({ sessionId: 'sess-abc' }, 201);
      const client = new OpenFamilyClient(BASE_CONFIG);
      const id = await client.startSession('agent-1', { agentName: 'MyAgent' });
      expect(id).toBe('sess-abc');
      expect(client.getSessionId()).toBe('sess-abc');
    });

    it('throws on non-OK response', async () => {
      global.fetch = mockFetch({ error: 'Policy not found' }, 404);
      const client = new OpenFamilyClient(BASE_CONFIG);
      await expect(client.startSession('agent-1')).rejects.toThrow('Policy not found');
    });

    it('sends X-OpenFamily-Key header', async () => {
      const fetchMock = mockFetch({ sessionId: 'sess-abc' }, 201);
      global.fetch = fetchMock;
      const client = new OpenFamilyClient(BASE_CONFIG);
      await client.startSession('agent-1');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['X-OpenFamily-Key']).toBe('of_test_key');
    });
  });

  describe('intercept', () => {
    it('returns InterceptResponse on 200', async () => {
      global.fetch = mockFetch({ allowed: true, decision: 'APPROVED', reason: 'ok' }, 200);
      const client = new OpenFamilyClient(BASE_CONFIG);
      const result = await client.intercept({
        sessionId: 'sess-1',
        toolName: 'web_search',
        toolInput: { query: 'hello' },
      });
      expect(result.allowed).toBe(true);
      expect(result.decision).toBe('APPROVED');
    });

    it('throws ToolBlockedError on 403', async () => {
      global.fetch = mockFetch({ allowed: false, decision: 'BLOCKED', reason: 'blocked by policy' }, 403);
      const client = new OpenFamilyClient(BASE_CONFIG);
      await expect(
        client.intercept({ sessionId: 'sess-1', toolName: 'bad_tool', toolInput: {} })
      ).rejects.toThrow(ToolBlockedError);
    });

    it('ToolBlockedError carries decision and reason', async () => {
      global.fetch = mockFetch(
        { allowed: false, decision: 'DENIED_BY_SUPERVISOR', reason: 'too risky', supervisorNotes: 'irreversible' },
        403
      );
      const client = new OpenFamilyClient(BASE_CONFIG);
      try {
        await client.intercept({ sessionId: 'sess-1', toolName: 'delete_db', toolInput: {} });
      } catch (err) {
        expect(err).toBeInstanceOf(ToolBlockedError);
        const blocked = err as ToolBlockedError;
        expect(blocked.decision).toBe('DENIED_BY_SUPERVISOR');
        expect(blocked.reason).toBe('too risky');
        expect(blocked.supervisorNotes).toBe('irreversible');
      }
    });
  });

  describe('setSessionId / getSessionId', () => {
    it('can set session externally', () => {
      const client = new OpenFamilyClient(BASE_CONFIG);
      client.setSessionId('external-sess');
      expect(client.getSessionId()).toBe('external-sess');
    });
  });
});

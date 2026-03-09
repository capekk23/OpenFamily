'use client';

import { useState } from 'react';

const DEFAULT_RULES = JSON.stringify({
  blockedTools: [],
  allowedDomains: [],
  useSupervisor: false,
  requireApproval: {
    always: false,
    forTools: [],
    approvalTimeoutSeconds: 300,
    timeoutBehavior: "deny"
  }
}, null, 2);

interface Props {
  initialName?: string;
  initialRules?: string;
  onSave: (name: string, rules: unknown) => Promise<void>;
  saveLabel?: string;
}

export default function PolicyEditor({ initialName = '', initialRules, onSave, saveLabel = 'Save Policy' }: Props) {
  const [name, setName] = useState(initialName);
  const [rulesText, setRulesText] = useState(initialRules ?? DEFAULT_RULES);
  const [error, setError] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const validateJson = (text: string) => {
    try {
      JSON.parse(text);
      setJsonError('');
      return true;
    } catch (e) {
      setJsonError((e as Error).message);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateJson(rulesText)) return;
    if (!name.trim()) { setError('Policy name is required'); return; }

    setSaving(true);
    try {
      await onSave(name.trim(), JSON.parse(rulesText));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const formatJson = () => {
    try {
      setRulesText(JSON.stringify(JSON.parse(rulesText), null, 2));
      setJsonError('');
    } catch { /* leave as-is */ }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

      <label style={labelStyle}>Policy Name</label>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Strict Research Agent"
        style={inputStyle}
        required
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Rules (JSON)</label>
        <button type="button" onClick={formatJson} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>
          Format JSON
        </button>
      </div>

      <textarea
        value={rulesText}
        onChange={e => { setRulesText(e.target.value); validateJson(e.target.value); }}
        style={{
          width: '100%',
          minHeight: 320,
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          padding: '0.75rem',
          border: `1px solid ${jsonError ? '#fca5a5' : '#d1d5db'}`,
          borderRadius: 6,
          resize: 'vertical',
          boxSizing: 'border-box',
          background: '#1e1e2e',
          color: '#cdd6f4',
          lineHeight: 1.6,
        }}
        spellCheck={false}
      />
      {jsonError && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem' }}>{jsonError}</div>}

      <div style={{ marginTop: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#475569' }}>
        <strong>Quick reference:</strong> <code>blockedTools</code> — always deny · <code>allowedTools</code> — allowlist ·
        <code> allowedDomains</code> — e.g. <code>["*.google.com"]</code> · <code>useSupervisor</code> — route to Claude ·
        <code> requireApproval.forTools</code> — require human sign-off
      </div>

      <button
        type="submit"
        disabled={saving || !!jsonError}
        style={{ marginTop: '1rem', background: saved ? '#22c55e' : '#1a1a2e', color: 'white', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 6, cursor: saving ? 'wait' : 'pointer', fontSize: '0.95rem' }}
      >
        {saved ? '✓ Saved!' : saving ? 'Saving…' : saveLabel}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.95rem', marginBottom: '1.25rem', boxSizing: 'border-box' };

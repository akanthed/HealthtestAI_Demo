"use client";
import React, { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';

export default function AuditTrailModal({ triggerLabel = 'System Audit Overview' }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const token = await auth.currentUser?.getIdToken?.();
      const resp = await fetch('/api/audit/recent?limit=50', { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      let data: any = {};
      try { data = await resp.json(); } catch {/* ignore json parse errors */}
      if (!resp.ok) {
        if (resp.status === 401) {
          throw new Error('Not authenticated. Please sign in.');
        }
        if (resp.status === 403) {
          throw new Error('Not authorized to view audit logs. Ensure your user has the admin custom claim or its email matches TRACEABILITY_ADMIN_EMAIL.');
        }
        throw new Error(data?.error || 'Failed to load audit logs');
      }
      setLogs(data.logs || []);
    } catch (e: any) { setError(e.message || String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (open) load(); }, [open]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{triggerLabel}</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-auto" role="dialog" aria-modal="true">
          <div className="bg-white rounded shadow-lg w-full max-w-4xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Audit Trail</h2>
              <div className="flex gap-2 items-center">
                <Button variant="secondary" size="sm" onClick={() => load()} disabled={loading}>Refresh</Button>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
              </div>
            </div>
            {loading && <div className="text-sm">Loading…</div>}
            {error && (
              <div className="text-sm text-red-600 space-y-2">
                <p>{error}</p>
                {error.includes('Not authorized') && (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-200 p-2 rounded">
                    <p className="font-medium">Admin Setup Tips:</p>
                    <ul className="list-disc ml-4 mt-1 space-y-1">
                      <li>Set env <code className="font-mono">TRACEABILITY_ADMIN_EMAIL</code> to your email and restart.</li>
                      <li>Or add a custom claim: <code className="font-mono">admin: true</code> to your Firebase user.</li>
                      <li>Re-login after claim change to refresh ID token.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
            {!loading && !error && (
              <div className="border rounded max-h-[60vh] overflow-auto text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1">Time</th>
                      <th className="text-left px-2 py-1">Action</th>
                      <th className="text-left px-2 py-1">Entity</th>
                      <th className="text-left px-2 py-1">User</th>
                      <th className="text-left px-2 py-1">Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} className="border-t hover:bg-gray-50">
                        <td className="px-2 py-1 whitespace-nowrap">{l.tsIso || (l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000).toISOString() : '')}</td>
                        <td className="px-2 py-1">{l.actionType}</td>
                        <td className="px-2 py-1">{l.entityType}{l.entityId ? `:${l.entityId}` : ''}</td>
                        <td className="px-2 py-1">{l.userEmail || l.userId || '—'}</td>
                        <td className="px-2 py-1 font-mono text-[10px] break-all max-w-[140px]">{(l.hash || '').slice(0,24)}…</td>
                      </tr>
                    ))}
                    {logs.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500">No audit logs</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

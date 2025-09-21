"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { auth } from '@/lib/firebase';
const TraceabilityHistory = React.lazy(() => import('@/components/TraceabilityHistory'));

export default function EvidencePackDetails({ invocationId }: { invocationId: string }) {
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<any[]>([]);
  const [invocation, setInvocation] = useState<any | null>(null);

  useEffect(() => {
    if (!invocationId) return;
    setLoading(true);
    (async () => {
      try {
        // Use server-side admin API to fetch invocation + audit to avoid client Firestore permission issues
        const resp = await fetch(`/api/traceability/invocation-details?invocationId=${encodeURIComponent(invocationId)}`);
        const data = await resp.json();
        if (data?.invocation) setInvocation(data.invocation);
        else setInvocation(null);
        setAudit(data?.audit || []);
      } catch (e) {
        console.warn('Failed loading evidence pack details', e);
        setAudit([]);
        setInvocation(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [invocationId]);

  if (loading) return <div className="p-2 text-sm">Loading details…</div>;
  if (!invocation) return <div className="p-2 text-sm text-muted-foreground">No invocation metadata.</div>;

  return (
    <div className="p-2 border rounded mt-2 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Invocation: {invocationId}</div>
          <div className="text-sm">User: {invocation.userEmail || invocation.userId || '—'}</div>
          {invocation.historyWritesSkipped ? (
            <div className="mt-1 text-xs text-yellow-800 bg-yellow-100 inline-block px-2 py-1 rounded">History writes skipped (non-strict)</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {/* Download Traceability / Manifest button */}
          {(() => {
            // Prefer the PDF signed URL where available. If not present, try to regenerate PDF via API and open it.
            const manifestUrl = invocation.manifestSignedUrl || invocation.mdSignedUrl || invocation.signedUrl || null;
            const manifestStoragePath = invocation.manifestStoragePath || invocation.mdStoragePath || invocation.storagePath || null;
            const pdfUrl = invocation.pdfSignedUrl || null;
            async function downloadPdfOrFallback() {
              // Try to download PDF (existing pdfSignedUrl or by regenerating type=pdf). If download fails, fallback to opening manifest/MD in new tab.
              const filename = `${invocationId}.pdf`;
              try {
                // Prefer server proxy which will stream the best file (PDF if available/generated)
                const proxy = `/api/traceability/download?invocationId=${encodeURIComponent(invocationId)}&filename=${encodeURIComponent(filename)}`;
                const token = await auth.currentUser?.getIdToken();
                const resp = await fetch(proxy, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                if (!resp.ok) throw new Error('Download proxy failed');
                const blob = await resp.blob();
                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(objUrl);
                return;
              } catch (e) {
                console.warn('Download attempt via proxy failed', e);
                // As a fallback try regenerating and opening the signed URL if available
                try {
                  const resp = await fetch('/api/traceability/regenerate', { method: 'POST', body: JSON.stringify({ invocationId, type: 'pdf' }), headers: { 'Content-Type': 'application/json' } });
                  const data = await resp.json();
                  if (data?.signedUrl) {
                    window.open(data.signedUrl, '_blank');
                    return;
                  }
                } catch (e2) {
                  console.warn('Regenerate fallback failed', e2);
                }
                // Final fallback: open manifest
                if (manifestUrl) window.open(manifestUrl, '_blank');
              }
            }

            if (!manifestUrl && !manifestStoragePath && !pdfUrl) {
              return (
                <button className="px-3 py-1 text-sm rounded border bg-gray-100 text-gray-500" disabled title="No manifest or report URL available">
                  Download Traceability (JSON)
                </button>
              );
            }
            return (
              <>
                <button
                  className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => downloadPdfOrFallback()}
                >
                  Download Traceability (PDF)
                </button>
                <button
                  className="px-3 py-1 text-sm rounded border bg-white text-gray-700"
                  onClick={async () => {
                    try {
                      // Prefer downloading via proxy when we have a storage path
                      if (manifestStoragePath) {
                        const proxy = `/api/traceability/download?storagePath=${encodeURIComponent(manifestStoragePath)}&filename=${encodeURIComponent(invocationId + '.traceability.json')}`;
                        const token = await auth.currentUser?.getIdToken();
                        window.open(proxy, '_blank');
                        return;
                      }
                      const resp = await fetch('/api/traceability/regenerate', { method: 'POST', body: JSON.stringify({ invocationId, type: 'manifest' }), headers: { 'Content-Type': 'application/json' } });
                      const data = await resp.json();
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                      else console.warn('Regenerate failed', data);
                    } catch (e) { console.warn('Regenerate error', e); }
                  }}
                >
                  Regenerate URL
                </button>
                <button
                  className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                  onClick={() => {
                    // call export API with invocationId
                    const url = `/api/traceability/export?invocationId=${encodeURIComponent(invocationId)}`;
                    window.open(url, '_blank');
                  }}
                >
                  Export CSV
                </button>
                <button
                  className="px-2 py-1 text-sm rounded border bg-white text-gray-700"
                  onClick={async () => {
                    try {
                      // copy the best available URL
                      const copyUrl = pdfUrl || manifestUrl;
                      if (copyUrl) await navigator.clipboard.writeText(copyUrl);
                    }
                    catch (e) { console.warn('Copy failed', e); }
                  }}
                >
                  Copy URL
                </button>
              </>
            );
          })()}
        </div>
      </div>
      
        <div className="mt-2">
        <div className="text-sm font-medium">Per-test-case snapshots</div>
        {audit.length === 0 ? (
          <div>
            <div className="text-sm text-muted-foreground">No snapshots</div>
            {invocation && invocation.traceability && Object.keys(invocation.traceability).length > 0 ? (
              <div className="mt-2 text-sm">The invocation contains traceability entries but no per-test-case audit subdocs. You can download the traceability manifest or individual snapshots using the download buttons.</div>
            ) : null}
          </div>
        ) : (
          <table className="w-full text-sm mt-2">
            <thead>
              <tr>
                <th className="text-left">TestCase</th>
                <th className="text-left">Signed URL</th>
                <th className="text-left">Checksum</th>
                <th className="text-left">History</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(a => (
                <tr key={a.testCaseId} className="border-t">
                  <td className="py-1">{a.testCaseId}</td>
                  <td className="py-1">
                    <button
                      className="text-blue-600 underline bg-transparent p-0"
                      onClick={async () => {
                        try {
                          const proxy = `/api/traceability/download?invocationId=${encodeURIComponent(invocationId)}&testCaseId=${encodeURIComponent(a.testCaseId)}&filename=${encodeURIComponent(a.testCaseId+'.json')}`;
                          const token = await auth.currentUser?.getIdToken();
                          const resp = await fetch(proxy, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                          if (!resp.ok) throw new Error('Download proxy failed');
                          const blob = await resp.blob();
                          const objUrl = URL.createObjectURL(blob);
                          const el = document.createElement('a');
                          el.href = objUrl;
                          el.download = `${a.testCaseId}.json`;
                          document.body.appendChild(el);
                          el.click();
                          el.remove();
                          URL.revokeObjectURL(objUrl);
                        } catch (e) {
                          console.warn('Proxy download failed, falling back to regenerate', e);
                          try {
                            const resp = await fetch('/api/traceability/regenerate', { method: 'POST', body: JSON.stringify({ invocationId, testCaseId: a.testCaseId }), headers: { 'Content-Type': 'application/json' } });
                            const data = await resp.json();
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                          } catch (e2) { console.warn('Regenerate error', e2); }
                        }
                      }}
                    >
                      Download
                    </button>
                    <button
                      className="ml-2 px-2 py-0.5 text-xs rounded border bg-white text-gray-700"
                      onClick={async () => {
                        try {
                          const resp = await fetch('/api/traceability/regenerate', { method: 'POST', body: JSON.stringify({ invocationId, testCaseId: a.testCaseId }), headers: { 'Content-Type': 'application/json' } });
                          const data = await resp.json();
                          if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                          else console.warn('Regenerate failed', data);
                        } catch (e) { console.warn('Regenerate error', e); }
                      }}
                    >
                      Regenerate
                    </button>
                  </td>
                  <td className="py-1 font-mono text-xs">{a.checksum}</td>
                  <td className="py-1">
                    <button
                      className="px-2 py-1 text-xs rounded border bg-white text-gray-700"
                      onClick={() => {
                        // toggle per-test-case history panel by setting a selectedTestCase state
                        const evt = new CustomEvent('showTraceHistory', { detail: { testCaseId: a.testCaseId } });
                        window.dispatchEvent(evt);
                      }}
                    >
                      View History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Slot to mount traceability history viewer; listens for global event */}
      <div id="traceability-history-slot">
        <TraceabilityHistorySlot />
      </div>
    </div>
  );
}

function TraceabilityHistorySlot() {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: any) => setSelected(e.detail?.testCaseId || null);
    window.addEventListener('showTraceHistory', handler as EventListener);
    return () => window.removeEventListener('showTraceHistory', handler as EventListener);
  }, []);

  if (!selected) return null;
  return (
    <Suspense fallback={<div className="p-2 text-sm">Loading history viewer…</div>}>
      <TraceabilityHistory testCaseId={selected} />
    </Suspense>
  );
}

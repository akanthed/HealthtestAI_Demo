"use client"

import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';

export default function TraceabilityHistory({ testCaseId }: { testCaseId: string }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [traceDoc, setTraceDoc] = useState<any | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [diffLines, setDiffLines] = useState<Array<{ left?: string; right?: string; same: boolean }>>([]);

  useEffect(() => {
    if (!testCaseId) return;
    setLoading(true);
    (async () => {
      try {
        const db = getFirestore(app);
        const traceRef = doc(db, 'traceability', testCaseId);
        const td = await getDoc(traceRef);
        if (td.exists()) setTraceDoc(td.data());
        else setTraceDoc(null);

        const q = query(collection(db, `traceability/${testCaseId}/history`), orderBy('snapshotAt', 'desc'));
        const snaps = await getDocs(q);
        const rows = snaps.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setHistory(rows);
      } catch (e) {
        console.warn('Failed loading traceability history', e);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [testCaseId]);

  if (loading) return <div className="p-2 text-sm">Loading history…</div>;
  if (!traceDoc && history.length === 0) return <div className="p-2 text-sm text-muted-foreground">No history available for {testCaseId}</div>;

  useEffect(() => {
    // compute diff when both sides selected and both have content fetched
    async function compute() {
      setDiffLines([]);
      if (!leftId || !rightId) return;
      const left = history.find(h => h.id === leftId);
      const right = history.find(h => h.id === rightId);
      if (!left || !right) return;
      const leftText = await fetchSnapshotContent(left);
      const rightText = await fetchSnapshotContent(right);
      const lLines = (leftText || '').split('\n');
      const rLines = (rightText || '').split('\n');
      const max = Math.max(lLines.length, rLines.length);
      const lines: Array<{ left?: string; right?: string; same: boolean }> = [];
      for (let i = 0; i < max; i++) {
        const L = lLines[i] ?? '';
        const R = rLines[i] ?? '';
        lines.push({ left: L, right: R, same: L === R });
      }
      setDiffLines(lines);
    }
    compute();
  }, [leftId, rightId, history]);

  return (
    <div className="p-2 border rounded mt-2 bg-white">
      <div className="text-sm font-medium">Traceability history for {testCaseId}</div>
      {traceDoc && traceDoc.lastSnapshot && (
        <div className="text-xs text-muted-foreground mt-1">Last snapshot: {traceDoc.lastSnapshot.invocationId} @ {traceDoc.lastSnapshot.snapshotAt?.toString?.() || String(traceDoc.lastSnapshot.snapshotAt)}</div>
      )}
      {history.length === 0 ? (
        <div className="text-sm text-muted-foreground mt-2">No history entries.</div>
      ) : (
        <>
          <table className="w-full text-sm mt-2">
            <thead>
              <tr>
                <th className="text-left">Snapshot</th>
                <th className="text-left">Signed URL</th>
                <th className="text-left">Checksum</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-t">
                  <td className="py-1">{h.invocationId || h.id}</td>
                  <td className="py-1"><a className="text-blue-600 underline" href={h.signedUrl} target="_blank" rel="noreferrer">Download</a></td>
                  <td className="py-1 font-mono text-xs">{h.checksum}</td>
                  <td className="py-1">
                    <button className="px-2 py-1 text-xs rounded border mr-1" onClick={async () => {
                      // toggle preview
                      if (previewId === h.id) { setPreviewId(null); setPreviewContent(null); return; }
                      setPreviewId(h.id);
                      const content = await fetchSnapshotContent(h);
                      setPreviewContent(content);
                    }}>
                      {previewId === h.id ? 'Hide' : 'Preview'}
                    </button>
                    <button className={`px-2 py-1 text-xs rounded mr-1 ${leftId===h.id?'bg-gray-200':''}`} onClick={() => setLeftId(leftId===h.id?null:h.id)}>Select L</button>
                    <button className={`px-2 py-1 text-xs rounded ${rightId===h.id?'bg-gray-200':''}`} onClick={() => setRightId(rightId===h.id?null:h.id)}>Select R</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {previewContent && previewId && (
            <div className="mt-3 p-2 bg-gray-50 border rounded">
              <div className="text-xs text-muted-foreground">Preview of {previewId}</div>
              <pre className="text-xs overflow-auto max-h-64">{previewContent}</pre>
            </div>
          )}

          {leftId && rightId && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="p-2 border rounded bg-white">
                <div className="text-xs font-medium">Left: {leftId}</div>
              </div>
              <div className="p-2 border rounded bg-white">
                <div className="text-xs font-medium">Right: {rightId}</div>
              </div>
              <div className="col-span-2 mt-2 overflow-auto max-h-96">
                <table className="w-full text-xs">
                  <thead>
                    <tr><th className="text-left">Left</th><th className="text-left">Right</th></tr>
                  </thead>
                  <tbody>
                    {diffLines.map((ln, idx) => (
                      <tr key={idx} className={ln.same ? '' : 'bg-yellow-50'}>
                        <td className="align-top font-mono whitespace-pre-wrap">{ln.left}</td>
                        <td className="align-top font-mono whitespace-pre-wrap">{ln.right}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

async function fetchSnapshotContent(h: any) {
  // If history record contains full snapshot content, prefer it
  if (h && h.snapshotContent) return typeof h.snapshotContent === 'string' ? h.snapshotContent : JSON.stringify(h.snapshotContent, null, 2);
  // If signedUrl is available, try fetching it (best-effort)
  if (h && h.signedUrl) {
    try {
      const res = await fetch(h.signedUrl);
      const text = await res.text();
      try { return JSON.stringify(JSON.parse(text), null, 2); } catch (e) { return text; }
    } catch (e) {
      return `Failed to fetch snapshot content: ${String(e)}`;
    }
  }
  return 'No snapshot content available';
}

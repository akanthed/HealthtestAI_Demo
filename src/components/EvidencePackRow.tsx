"use client"

import React, { useState } from 'react';
import { auth } from '@/lib/firebase';
import EvidencePackDetails from '@/components/EvidencePackDetails';

export default function EvidencePackRow({ invocation }: { invocation: any }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const pdfFilename = `${invocation.id}.pdf`;

  async function fetchAndSave(url: string, outFilename?: string) {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!res.ok) throw new Error('Fetch failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = outFilename || pdfFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      return true;
    } catch (e) {
      console.warn('Download failed', e);
      return false;
    }
  }

  async function handleDownload() {
    try {
      setLoading(true);
      // Use server proxy to download (avoids CORS). The proxy will find the best file for this invocation.
      const proxyUrl = `/api/traceability/download?invocationId=${encodeURIComponent(invocation.id)}&filename=${encodeURIComponent(pdfFilename)}`;
      const token = await auth.currentUser?.getIdToken();
      const resp = await fetch(proxyUrl, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!resp.ok) throw new Error('Download proxy failed');
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = pdfFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      console.warn('Download/open failed', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="border px-2 py-1">{invocation.id}</td>
        <td className="border px-2 py-1">{invocation.userEmail || invocation.userId || '—'}</td>
        <td className="border px-2 py-1">{(invocation.standards || []).join(', ')}</td>
        <td className="border px-2 py-1">
          {invocation.createdAt ? (invocation.createdAt.seconds ? new Date(invocation.createdAt.seconds * 1000).toLocaleString() : String(invocation.createdAt)) : '—'}
        </td>
        <td className="border px-2 py-1">
          <button className="text-blue-600 underline bg-transparent p-0" onClick={handleDownload}>
            {loading ? 'Generating PDF…' : invocation.pdfSignedUrl ? 'PDF' : (invocation.manifestSignedUrl || invocation.mdSignedUrl || invocation.signedUrl) ? 'Download' : '—'}
          </button>
          { (invocation.manifestSignedUrl || invocation.mdSignedUrl || invocation.signedUrl) ? (
                <span> { ' | ' }<button className="text-green-600 underline bg-transparent p-0" onClick={async () => {
              try {
                const proxy = `/api/traceability/download?invocationId=${encodeURIComponent(invocation.id)}&filename=${encodeURIComponent(invocation.id+'-manifest.json')}`;
                const token = await auth.currentUser?.getIdToken();
                const resp = await fetch(proxy, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                if (!resp.ok) throw new Error('proxy failed');
                const blob = await resp.blob();
                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = `${invocation.id}-manifest.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(objUrl);
              } catch (e) { console.warn('Manifest download failed', e); }
            }}>Manifest</button></span>
          ) : null}
        </td>
        <td className="border px-2 py-1">{invocation.reportSize || '—'}</td>
        <td className="border px-2 py-1">
          <button className="text-sm text-blue-600 underline" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={7} className="p-2">
            <EvidencePackDetails invocationId={invocation.id} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

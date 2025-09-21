"use client"

import React, { useState } from 'react';
import AuditTimeline from './AuditTimeline';
import SearchFilters from './SearchFilters';

export default function AuditTrailModal({ entityType, entityId }: { entityType?: string; entityId?: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (filters: { from?: string; to?: string; limit?: number }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set('entityType', entityType);
      if (entityId) params.set('entityId', entityId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.limit) params.set('limit', String(filters.limit));
      const res = await fetch(`/api/audit-logs?${params.toString()}`, { credentials: 'include' });
      const j = await res.json();
      setRows(j.rows || []);
    } catch (e) {
      console.warn('Failed fetching audit logs', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button className="px-3 py-1 rounded bg-gray-100 border" onClick={() => setOpen(true)}>View Audit Trail</button>
      {open ? (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50">
          <div className="bg-white rounded shadow-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Audit Trail{entityType ? `: ${entityType}${entityId ? ' / ' + entityId : ''}` : ''}</h3>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 text-sm" onClick={() => { fetchLogs({ limit: 100 }); }}>Refresh</button>
                <button className="px-2 py-1 text-sm" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>
            <div className="p-4">
              <SearchFilters onSearch={(f) => fetchLogs(f)} />
              {loading ? <div className="text-sm">Loading…</div> : <AuditTimeline rows={rows} />}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";
import React from 'react';

export function ExportDialog({ logs }: { logs: any[] }) {
  function exportCsv() {
    const headers = ['id','timestamp','actionType','entityType','entityId','userId','userEmail'];
    const rows = logs.map(l => headers.map(h => JSON.stringify(l[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'audit_logs.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return <button className="px-2 py-1 text-xs border rounded" onClick={exportCsv}>Export CSV</button>;
}

"use client"

import React from 'react';

export default function AuditTimeline({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) return <div className="text-sm text-muted-foreground">No audit events found.</div>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="p-2 border rounded">
          <div className="flex items-center justify-between text-sm">
            <div>
              <div className="font-medium">{r.actionType}</div>
              <div className="text-xs text-muted-foreground">{r.entityType} {r.entityId ? `/ ${r.entityId}` : ''}</div>
            </div>
            <div className="text-xs font-mono">{r.timestamp ? (new Date(r.timestamp.seconds ? r.timestamp.seconds * 1000 : r.timestamp).toISOString()) : '—'}</div>
          </div>
          {r.userEmail || r.userId ? <div className="mt-2 text-sm">By: {r.userEmail || r.userId}</div> : null}
          {r.oldValues || r.newValues ? (
            <div className="mt-2 text-xs font-mono bg-gray-50 p-2 rounded">
              {r.oldValues ? <div><strong>Old:</strong> <pre className="whitespace-pre-wrap">{JSON.stringify(r.oldValues, null, 2)}</pre></div> : null}
              {r.newValues ? <div><strong>New:</strong> <pre className="whitespace-pre-wrap">{JSON.stringify(r.newValues, null, 2)}</pre></div> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

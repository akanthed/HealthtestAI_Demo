"use client";
import React from 'react';

export function AuditTimeline({ logs }: { logs: any[] }) {
  return (
    <ol className="relative border-l border-gray-300 pl-4 text-sm">
      {logs.map(l => (
        <li key={l.id} className="mb-4 ml-2">
          <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-500"></div>
          <time className="block text-xs text-gray-500">{l.tsIso || (l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000).toISOString() : '')}</time>
          <p className="font-medium">{l.actionType}</p>
          <p className="text-gray-600">{l.entityType}{l.entityId ? `:${l.entityId}` : ''}</p>
        </li>
      ))}
      {logs.length === 0 && <li className="text-gray-500">No activity</li>}
    </ol>
  );
}

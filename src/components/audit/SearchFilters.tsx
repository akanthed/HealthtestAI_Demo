"use client";
import React, { useState } from 'react';

export function SearchFilters({ onChange }: { onChange: (v: { entityType?: string; actionType?: string; from?: string; to?: string; }) => void }) {
  const [state, setState] = useState<{ entityType?: string; actionType?: string; from?: string; to?: string; }>({});
  function update(k: string, v: string) {
    const next = { ...state, [k]: v || undefined };
    setState(next); onChange(next);
  }
  return (
    <div className="flex flex-wrap gap-2 items-end text-sm">
      <div>
        <label className="block text-xs font-medium">Entity Type</label>
        <input className="border rounded px-2 py-1 text-sm" value={state.entityType || ''} onChange={e => update('entityType', e.target.value)} placeholder="testCase" />
      </div>
      <div>
        <label className="block text-xs font-medium">Action Type</label>
        <input className="border rounded px-2 py-1 text-sm" value={state.actionType || ''} onChange={e => update('actionType', e.target.value)} placeholder="testcase.executed" />
      </div>
      <div>
        <label className="block text-xs font-medium">From</label>
        <input type="date" className="border rounded px-2 py-1 text-sm" value={state.from || ''} onChange={e => update('from', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium">To</label>
        <input type="date" className="border rounded px-2 py-1 text-sm" value={state.to || ''} onChange={e => update('to', e.target.value)} />
      </div>
    </div>
  );
}

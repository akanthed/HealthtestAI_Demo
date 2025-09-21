"use client"

import React, { useState } from 'react';

export default function SearchFilters({ onSearch }: { onSearch: (filters: { from?: string; to?: string; limit?: number }) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(100);

  return (
    <div className="flex items-end gap-2 mb-4">
      <div>
        <label className="text-xs">From</label>
        <input className="block border px-2 py-1" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <label className="text-xs">To</label>
        <input className="block border px-2 py-1" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div>
        <label className="text-xs">Limit</label>
        <input className="block border px-2 py-1 w-20" type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value || '0'))} />
      </div>
      <div>
        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={() => onSearch({ from: from || undefined, to: to || undefined, limit })}>Search</button>
      </div>
    </div>
  );
}

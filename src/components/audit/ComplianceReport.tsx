"use client";
import React from 'react';

export function ComplianceReport({ summary }: { summary: Array<{ standard: string; compliant: boolean; gaps: number; evidenceCount: number; }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {summary.map(s => (
        <div key={s.standard} className="border rounded p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-sm">{s.standard}</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${s.compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.compliant ? 'Compliant' : 'Gaps'}</span>
          </div>
          <div className="text-xs text-gray-600">Evidence: {s.evidenceCount}</div>
          <div className="text-xs text-gray-600">Gaps: {s.gaps}</div>
        </div>
      ))}
      {summary.length === 0 && <div className="text-sm text-gray-500">No compliance data</div>}
    </div>
  );
}

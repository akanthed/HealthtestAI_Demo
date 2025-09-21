"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface MatrixRow {
  requirementId: string;
  title?: string;
  testCaseIds: string[];
  counts: Record<string, number>;
  total: number;
  coverageStatus: string;
}
interface MatrixSummary {
  totalRequirements: number; coveredRequirements: number; fullyApprovedRequirements: number; uncoveredRequirements: number; coveragePercent: number; fullyApprovedPercent: number;
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    uncovered: 'bg-red-100 text-red-700 border-red-300',
    in_progress: 'bg-amber-100 text-amber-700 border-amber-300',
    partially_approved: 'bg-blue-100 text-blue-700 border-blue-300',
    fully_approved: 'bg-green-100 text-green-700 border-green-300',
  };
  const cls = colorMap[status] || 'bg-gray-100 text-gray-600 border-gray-300';
  return <span className={`inline-block text-xs px-2 py-0.5 rounded border ${cls}`}>{status.replace(/_/g,' ')}</span>;
}

export function TraceabilityMatrix() {
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [summary, setSummary] = useState<MatrixSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [lastUpdated, setLastUpdated] = useState<string|null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    try {
      setRefreshing(true);
      const url = `/api/traceability/matrix${force ? '?force=1' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed');
      setRows(data.rows || []);
      setSummary(data.summary || null);
      setLastUpdated(data.generatedAt || new Date().toISOString());
      setError(null);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(false); }, [fetchData]);

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="w-4 h-4 animate-spin"/> Loading traceability matrix...</div>;
  }
  if (error) {
    return <div className="text-sm text-red-600">Failed to load matrix: {error} <button onClick={()=>fetchData(true)} className="underline ml-2">Retry</button></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="text-sm text-gray-700">
          {summary && (
            <>
              <span className="font-medium">Requirements:</span> {summary.totalRequirements} • Covered {summary.coveredRequirements} ({summary.coveragePercent.toFixed(1)}%) • Fully Approved {summary.fullyApprovedRequirements} ({summary.fullyApprovedPercent.toFixed(1)}%) • Uncovered {summary.uncoveredRequirements}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {lastUpdated && <span>Generated: {new Date(lastUpdated).toLocaleTimeString()}</span>}
          <button disabled={refreshing} onClick={()=>fetchData(true)} className="border px-2 py-1 rounded text-xs hover:bg-gray-50 disabled:opacity-50">{refreshing ? 'Refreshing…' : 'Force Refresh'}</button>
        </div>
      </div>
      <div className="overflow-auto max-h-[480px] border rounded">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="border px-2 py-1 text-left w-32">Requirement</th>
              <th className="border px-2 py-1 text-left min-w-[220px]">Title</th>
              <th className="border px-2 py-1 text-left">Test Cases</th>
              <th className="border px-2 py-1 text-left">Counts</th>
              <th className="border px-2 py-1 text-left">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.requirementId} className="border-t hover:bg-gray-50">
                <td className="px-2 py-1 font-medium whitespace-nowrap">{r.requirementId}</td>
                <td className="px-2 py-1 truncate max-w-[260px]" title={r.title || ''}>{r.title || '—'}</td>
                <td className="px-2 py-1">
                  {r.testCaseIds.length === 0 ? <span className="text-gray-400">—</span> : (
                    <div className="flex flex-wrap gap-1">
                      {r.testCaseIds.slice(0,10).map(id => <span key={id} className="px-1 py-0.5 bg-gray-100 rounded border text-xs">{id}</span>)}
                      {r.testCaseIds.length > 10 && <span className="text-gray-500 text-xs">+{r.testCaseIds.length - 10} more</span>}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1">
                  {Object.keys(r.counts).length === 0 ? '—' : (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(r.counts).map(([k,v]) => (
                        <span key={k} className="rounded bg-gray-100 px-1 py-0.5 border text-xs" title={k}>{k}:{v}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1"><StatusBadge status={r.coverageStatus}/></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-gray-500">No requirements found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

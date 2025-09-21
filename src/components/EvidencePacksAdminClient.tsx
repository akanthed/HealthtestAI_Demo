"use client"

import React from 'react';
import EvidencePackRow from '@/components/EvidencePackRow';
import dynamic from 'next/dynamic';

const AuditTrailModal = dynamic(() => import('@/components/AuditTrailModal'), { ssr: false });

export default function EvidencePacksAdminClient({ rows }: { rows: any[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Evidence Pack Invocations</h1>
        <div className="flex items-center gap-2">
          <AuditTrailModal entityType="evidencePack" />
        </div>
      </div>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1">ID</th>
            <th className="border px-2 py-1">User</th>
            <th className="border px-2 py-1">Standards</th>
            <th className="border px-2 py-1">Created</th>
            <th className="border px-2 py-1">Report</th>
            <th className="border px-2 py-1">Size</th>
            <th className="border px-2 py-1">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <EvidencePackRow key={r.id} invocation={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

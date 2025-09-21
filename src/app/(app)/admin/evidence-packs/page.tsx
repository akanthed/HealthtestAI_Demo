"use server";

import { admin } from '@/lib/firebase-admin';
import Link from 'next/link';
import EvidencePacksAdminClient from '@/components/EvidencePacksAdminClient';
import { sanitizeObject } from '@/lib/sanitize';

type Invocation = {
  id: string;
  userId?: string;
  userEmail?: string | null;
  standards?: string[];
  dateRange?: any;
  createdAt?: any;
  signedUrl?: string | null;
  mdSignedUrl?: string | null;
  pdfSignedUrl?: string | null;
  reportSize?: number | null;
};

export default async function EvidencePacksAdminPage() {
  const db = admin.firestore();
  const snapshot = await db.collection('evidencePackInvocations').orderBy('createdAt', 'desc').limit(100).get();
  const rows: Invocation[] = snapshot.docs.map(d => {
    const data = d.data() as any;
    const safe = sanitizeObject(data || {});
    return { id: d.id, ...safe } as Invocation;
  });
  // Filter to only show invocations for the requested user (temporary admin view)
  const filtered = rows.filter(r => (r.userEmail || '').toLowerCase() === 'akshay.kanthed007@gmail.com');
  return (
    <div className="p-6">
      {/* Render client-side wrapper and pass server-fetched rows as props */}
  <EvidencePacksAdminClient rows={filtered} />
    </div>
  );
}

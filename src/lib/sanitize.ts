// Reusable sanitizer to convert Firestore Timestamps and other non-plain JS
// objects into plain serializable values suitable for passing from server
// components to client components in Next.js. Mirrors the logic previously
// inlined in the admin evidence-packs server page.
export function sanitizeValue(v: any): any {
  if (v == null) return null;
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') return v;
  try {
    if (typeof v.toDate === 'function') {
      return v.toDate().toISOString();
    }
  } catch (e) {
    // ignore
  }
  if (typeof v === 'object' && typeof v.seconds === 'number') {
    const nanos = typeof v.nanoseconds === 'number' ? v.nanoseconds : (typeof v._nanoseconds === 'number' ? v._nanoseconds : 0);
    try {
      return new Date(v.seconds * 1000 + Math.floor(nanos / 1000000)).toISOString();
    } catch (e) {
      // fallthrough
    }
  }
  if (Array.isArray(v)) return v.map((x) => sanitizeValue(x));
  if (typeof v === 'object') {
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = sanitizeValue(val);
    }
    return out;
  }
  try { return String(v); } catch (e) { return null; }
}

export function sanitizeObject(obj: Record<string, any> | undefined | null) {
  if (obj == null) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = sanitizeValue(v);
  }
  return out;
}

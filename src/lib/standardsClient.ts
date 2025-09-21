// Client-friendly wrapper for standards canonicalization
// This file re-exports a minimal, stable surface so client code can canonicalize
// user-friendly labels into stored canonical tags before issuing Firestore queries
// or calling server-side flows.
import { expandStandards as _expandStandards, formatTag as _formatTag, formatTags as _formatTags } from '@/config/standards';

// Thin wrapper that ensures inputs are strings/arrays and returns canonical tokens
export function toCanonicalTags(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  try {
    return _expandStandards(arr.map((s) => (s == null ? '' : String(s))));
  } catch (e) {
    // fallback: return trimmed originals
    return arr.map((s) => String(s).trim()).filter(Boolean);
  }
}

export function formatTag(tag?: string | null) {
  return _formatTag(tag);
}

export function formatTags(tags?: string[] | null) {
  return _formatTags(tags);
}

export default { toCanonicalTags, formatTag, formatTags };

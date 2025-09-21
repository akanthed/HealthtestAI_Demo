// Central canonical mapping for compliance standards
export const canonicalMap: Record<string, string[]> = {
	hipaa: ['HIPAA_164.312'],
	hippa: ['HIPAA_164.312'], // common misspelling -> same canonical tag
	gdpr: ['GDPR'],
	fda: ['FDA'],
	'iso 13485': ['ISO_13485'],
	'iso13485': ['ISO_13485'],
	'iec 62304': ['IEC_62304'],
	'iec62304': ['IEC_62304'],
	'iso 14971': ['ISO_14971'],
	'iso14971': ['ISO_14971'],
};

// Human-friendly display labels for canonical codes
export const displayMap: Record<string, string> = {
	'HIPAA_164.312': 'HIPAA',
	GDPR: 'GDPR',
	FDA: 'FDA',
	ISO_13485: 'ISO 13485',
	IEC_62304: 'IEC 62304',
	ISO_14971: 'ISO 14971',
};

// Preferred display list order (UI helpers can use this)
export const preferredDisplayOrder = [
	'HIPAA',
	'FDA',
	'ISO 13485',
	'IEC 62304',
	'ISO 14971',
	'GDPR',
];

export function normalizeInput(s: any): string {
	return (s || '').toString().toLowerCase().trim();
}

// Expand user-friendly inputs (e.g. 'HIPAA' or 'HIPPA') to canonical stored tags
export function expandStandards(inputs?: string[] | null): string[] {
	if (!inputs || inputs.length === 0) return [];
	const out: string[] = [];
	for (const raw of inputs) {
		const n = normalizeInput(raw);
		if (canonicalMap[n]) {
			for (const c of canonicalMap[n]) {
				if (!out.includes(c)) out.push(c);
			}
		} else if (raw && String(raw).trim()) {
			// keep as-is if unknown (may already be a canonical code)
			const asStr = String(raw).trim();
			if (!out.includes(asStr)) out.push(asStr);
		}
	}
	return out;
}

// Format a canonical code to a user-friendly label when available
export function formatTag(tag?: string | null): string | undefined {
	if (!tag) return undefined;
	return displayMap[tag] || tag;
}

export function formatTags(tags?: string[] | null): string[] {
	if (!tags) return [];
	return tags.map((t) => formatTag(t) || String(t));
}

export default {
	canonicalMap,
	displayMap,
	expandStandards,
	normalizeInput,
	formatTag,
	formatTags,
	preferredDisplayOrder,
};

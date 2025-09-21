import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { generateEvidencePack } from '@/ai/flows/generate-evidence-pack';

// POST /api/generate-evidence-pack
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
    if (!idToken) return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const body = await req.json();

    // Validate input shape on the server briefly
    const standards = Array.isArray(body.standards) ? body.standards.map(String) : [];
    const dateRange = body.dateRange || { from: null, to: null };

    // Call the flow
    const result = await generateEvidencePack({ standards, dateRange });

    // Persist invocation metadata to Firestore (enrich if flow returned invocationId/traceability)
    try {
      const db = admin.firestore();
      // If flow created an invocation doc (we created invocationId), try to update that doc with user info and traceability
      if (result && ((result as any).invocationId || ((result as any).traceability && Object.keys((result as any).traceability).length > 0))) {
        // The flow wrote an invocation doc named like 'inv-<ts>-<rand>' inside evidencePackInvocations
        // If flow returned explicit invocationId, update that exact doc
        const invCol = db.collection('evidencePackInvocations');
        const invId = (result as any).invocationId;
        if (invId) {
          try {
            const ref = invCol.doc(invId);
            await ref.update({
              userId: decoded.uid,
              userEmail: decoded.email || null,
              standards,
              dateRange,
              reportSize: typeof result.report === 'string' ? result.report.length : null,
              mdSignedUrl: result.mdSignedUrl || null,
              pdfSignedUrl: result.pdfSignedUrl || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              traceability: (result as any).traceability || null,
            });
          } catch (uerr) {
            // doc might not exist, fallback to creating new
            await invCol.doc().set({
              userId: decoded.uid,
              userEmail: decoded.email || null,
              standards,
              dateRange,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              signedUrl: result.signedUrl || null,
              mdSignedUrl: result.mdSignedUrl || null,
              pdfSignedUrl: result.pdfSignedUrl || null,
              reportSize: typeof result.report === 'string' ? result.report.length : null,
              traceability: (result as any).traceability || null,
            });
          }
        } else {
          // fallback heuristic: find recent invocation and update
          try {
            const recent = await invCol.orderBy('createdAt', 'desc').limit(10).get();
            let found: admin.firestore.DocumentSnapshot | null = null;
            for (const docSnap of recent.docs) {
              const data: any = docSnap.data() || {};
              if (data && data.matchedCount === (result as any).matchedCount) {
                found = docSnap;
                break;
              }
            }
            if (found) {
              await found.ref.update({
                userId: decoded.uid,
                userEmail: decoded.email || null,
                standards,
                dateRange,
                reportSize: typeof result.report === 'string' ? result.report.length : null,
                mdSignedUrl: result.mdSignedUrl || null,
                pdfSignedUrl: result.pdfSignedUrl || null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                traceability: (result as any).traceability || null,
              });
            } else {
              await invCol.doc().set({
                userId: decoded.uid,
                userEmail: decoded.email || null,
                standards,
                dateRange,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                signedUrl: result.signedUrl || null,
                mdSignedUrl: result.mdSignedUrl || null,
                pdfSignedUrl: result.pdfSignedUrl || null,
                reportSize: typeof result.report === 'string' ? result.report.length : null,
                traceability: (result as any).traceability || null,
              });
            }
          } catch (qerr) {
            console.warn('Could not correlate invocation doc; writing new one', qerr);
            await db.collection('evidencePackInvocations').doc().set({
              userId: decoded.uid,
              userEmail: decoded.email || null,
              standards,
              dateRange,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              signedUrl: result.signedUrl || null,
              mdSignedUrl: result.mdSignedUrl || null,
              pdfSignedUrl: result.pdfSignedUrl || null,
              reportSize: typeof result.report === 'string' ? result.report.length : null,
              traceability: (result as any).traceability || null,
            });
          }
        }
      } else {
        // no detailed traceability returned; write a minimal invocation record
        const invRef = db.collection('evidencePackInvocations').doc();
        await invRef.set({
          userId: decoded.uid,
          userEmail: decoded.email || null,
          standards,
          dateRange,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          signedUrl: result.signedUrl || null,
          reportSize: typeof result.report === 'string' ? result.report.length : null,
        });
      }
    } catch (err) {
      console.warn('Could not persist invocation metadata', err);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error in generate-evidence-pack API:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

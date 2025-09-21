// src/components/TestCaseList.tsx
"use client";

import { useMemo } from "react";
import { useTestCases } from "@/hooks/useTestCases";
import { doc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

export default function TestCaseList({ requirementId, testCases: providedTestCases }: { requirementId?: string; testCases?: any[] }) {
  const { toast } = useToast();
  // If the caller provided a testCases array, use it instead of fetching via hook.
  const fromHook = useTestCases(requirementId || '');
  const { testCases, loading, error } = providedTestCases ? { testCases: providedTestCases, loading: false, error: null } : fromHook;

  const formatted = useMemo(() => {
    return testCases.map((tc) => {
      // convert Firestore Timestamp-like to readable date
      let dateStr = "";
      if (tc.createdAt && typeof tc.createdAt === "object" && "seconds" in tc.createdAt) {
        dateStr = new Date((tc.createdAt as any).seconds * 1000).toLocaleString();
      } else if (typeof tc.createdAt === "string") {
        dateStr = new Date(tc.createdAt).toLocaleString();
      }
      return { ...tc, dateStr };
    });
  }, [testCases]);

  const handleDelete = async (id: string) => {
    if (!auth || !auth.currentUser) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be signed in to delete test cases." });
      return;
    }

    const ok = confirm('Delete this test case? This cannot be undone.');
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'testCases', id));
      toast({ title: "Success", description: `Test case ${id} deleted.` });
      // The UI will update automatically via the onSnapshot listener in useTestCases
    } catch (e: any) {
      console.error('Delete failed', e);
      const description = e.code === 'permission-denied' 
        ? "You do not have permission to delete this document. Please check Firestore security rules."
        : "Failed to delete test case. Please try again later.";
      toast({ variant: "destructive", title: "Deletion Error", description });
    }
  };

  if (loading) return <div>Loading test cases…</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!testCases || testCases.length === 0) return <div>No test cases generated yet.</div>;

  return (
    <div className="space-y-4">
      {formatted.map((tc) => (
        <div key={tc.id} className="p-4 rounded shadow-sm bg-white">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">{tc.title || tc.id}</h3>
              <div className="text-xs text-gray-500">ID: {(tc as any).sourceId || tc.id}</div>
            </div>
            <span className="text-sm text-gray-500">{(tc as any).dateStr}</span>
          </div>
          <p className="text-sm text-gray-700 mt-2">{tc.description}</p>

            {tc.steps && Array.isArray(tc.steps) && (
            <ol className="mt-2 ml-4 list-decimal">
              {tc.steps.map((s: any, i: number) => (
                <li key={i} className="text-sm text-gray-700">{s}</li>
              ))}
            </ol>
          )}

          <div className="mt-3 text-sm text-gray-600">
            <strong>Expected:</strong> {tc.expectedResults}
          </div>

          {tc.classificationTags && tc.classificationTags.length > 0 && (
            <div className="mt-3">
              {tc.classificationTags.map((tag: any) => (
                  <span key={tag} className="inline-block mr-2 px-2 py-1 bg-slate-100 rounded text-xs">
                    {tag}
                  </span>
                ))}
            </div>
          )}
          {( (tc as any).complianceLabels && (tc as any).complianceLabels.length > 0) || ((tc as any).complianceTags && (tc as any).complianceTags.length > 0) ? (
            <div className="mt-3">
              {((tc as any).complianceLabels && (tc as any).complianceLabels.length > 0 ? (tc as any).complianceLabels : (tc as any).complianceTags).map((tag: string) => (
                <span key={tag} className="inline-block mr-2 px-2 py-1 bg-amber-100 rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              className="text-sm text-red-600 hover:underline"
              onClick={() => handleDelete(tc.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

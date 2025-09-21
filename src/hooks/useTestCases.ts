
// src/hooks/useTestCases.ts
"use client";

import { useEffect, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getFirestore,
  QueryConstraint,
  limit,
} from "firebase/firestore";
import { app } from "@/lib/firebase";
import type { TestCase as TestCaseType } from "@/lib/data";


export function useTestCases(requirementId: string | null, count: number | null = 50) {
  const [testCases, setTestCases] = useState<TestCaseType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const db = getFirestore(app);

    const constraints: QueryConstraint[] = [
      orderBy("createdAt", "desc"),
    ];
    
    if (count !== null) {
        constraints.push(limit(count));
    }

    if (requirementId) {
        constraints.unshift(where("requirementId", "==", requirementId));
    }

    // build query
    const q = query(collection(db, "testCases"), ...constraints);

    const unsub: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: TestCaseType[] = snapshot.docs.map((d) => {
          const data = d.data();
          const createdAt = data.createdAt?.seconds 
            ? new Date(data.createdAt.seconds * 1000).toISOString()
            : new Date().toISOString();

          return {
            id: d.id,
            ...(data as Omit<TestCaseType, 'id' | 'createdAt'>),
            createdAt,
          };
        });
        setTestCases(docs);
        setLoading(false);
      },
      (err) => {
        console.error("useTestCases onSnapshot error:", err);
        setError(String(err?.message ?? err));
        setLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [requirementId, count]);

  return { testCases, loading, error };
}

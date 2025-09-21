// src/app/(app)/requirements/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import GenerateButton from "@/components/GenerateButton";
import TestCaseList from "@/components/TestCaseList";

export default function RequirementDetailPage() {
  const params = useParams();
  const requirementId = params?.id as string;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Requirement {requirementId}</h1>
        <GenerateButton requirementId={requirementId} />
      </header>

      <section>
        <h2 className="text-lg font-medium">Generated Test Cases</h2>
        <TestCaseList requirementId={requirementId} />
      </section>
    </div>
  );
}

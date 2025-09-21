"use client";

import generateTestCases from "@/lib/api";

export default function GenerateButton({ requirementId, requirementText }: { requirementId: string; requirementText?: string }) {
  const handleClick = async () => {
    try {
      // requirementId is not used by the external API; we pass the text.
      if (!requirementText) throw new Error('No requirement text available to send to API');
  const result = await generateTestCases(requirementText, undefined, requirementId);
      console.log("Generated test cases:", result);
      alert("AI test cases generated successfully!");
    } catch (err: any) {
      console.error(err);
      alert(`Failed: ${err.message}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
    >
      Generate with AI
    </button>
  );
}

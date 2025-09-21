
"use client"

import { useState, useEffect,useContext } from "react"
import { Upload, Inbox, Wand2, ShieldCheck, FileText } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import TestCaseList from '@/components/TestCaseList'
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import generateTestCases from '@/lib/api'
import { LoadingContext } from "@/app/(app)/layout"


const complianceStandardsOptions = ["FDA", "ISO 13485", "IEC 62304", "HIPAA"]

// Use shared client helper which calls the external API directly.
async function callGenerateTestCases(requirementText: string, testTypes?: string[], requirementId?: string) {
  return generateTestCases(requirementText, testTypes, requirementId);
}


export default function RequirementsPage() {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [requirementText, setRequirementText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [prompt, setPrompt] = useState("");
  const [complianceStandards, setComplianceStandards] = useState<string[]>([]);
  const { toast } = useToast()
  const router = useRouter()
  // modal state for existing requirement
  const [existingModalOpen, setExistingModalOpen] = useState(false);
  const [existingRequirementId, setExistingRequirementId] = useState<string | null>(null);
  const [existingTestCasesList, setExistingTestCasesList] = useState<any[]>([]);
  const [checkFailedModalOpen, setCheckFailedModalOpen] = useState(false);
  const [checkFailedIndexUrl, setCheckFailedIndexUrl] = useState<string | null>(null);
  const [coverageInfo, setCoverageInfo] = useState<{ count: number; status: string } | null>(null);
  const { setLoading } = useContext(LoadingContext);

  // Fetch coverage for current requirement (if one identified) using filtered matrix endpoint
  useEffect(() => {
    let active = true;
    async function fetchCoverage(rid: string) {
      try {
        const res = await fetch(`/api/traceability/matrix?rid=${encodeURIComponent(rid)}&force=1`);
        if (!res.ok) return;
        const json = await res.json();
        const row = Array.isArray(json.rows) ? json.rows[0] : null;
        if (row && active) {
          setCoverageInfo({ count: row.total || 0, status: row.coverageStatus });
        }
      } catch {}
    }
    if (existingRequirementId) fetchCoverage(existingRequirementId);
    return () => { active = false; };
  }, [existingRequirementId]); 


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0]
      setFiles([file])
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setRequirementText(event.target.result as string)
        }
      }
      reader.readAsText(file)
    }
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
       const file = e.dataTransfer.files[0]
      setFiles([file])
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setRequirementText(event.target.result as string)
        }
      }
      reader.readAsText(file)
    }
  }
  
  const handleGenerateClick = async () => {
    if (!requirementText.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a requirement document or text.",
      })
      return
    }
    setIsLoading(true)
    setLoading(true);
    // Clear previous temporary data
    sessionStorage.removeItem("generatedTestCases");
    sessionStorage.removeItem("allTestCases");

    try {
      // 1) Call upsert endpoint to detect existing requirement (and create requirement if new)
      const upsertRes = await fetch('/api/requirements/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementText, title: '' }),
      });
      const upsertJson = await upsertRes.json();
      if (upsertRes.status === 412 && upsertJson?.error === 'check_failed') {
        // Firestore requested an index and we couldn't run dedupe
        setCheckFailedIndexUrl(upsertJson.indexUrl || null);
        setCheckFailedModalOpen(true);
        return;
      }
      if (upsertJson?.existing) {
        // Open modal to list existing test cases and let the user choose
        const existingId = upsertJson.requirementId;
        setExistingRequirementId(existingId);
        setExistingTestCasesList(upsertJson.testCases || []);
        setExistingModalOpen(true);
        return;
      }

      // New requirement created: link generated test cases to this requirement id
      if (upsertJson && upsertJson.requirementId) {
        await doGenerate(upsertJson.requirementId);
      } else {
        await doGenerate();
      }
    } catch (error: any) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate test cases. Please try again.",
      })
    } finally {
      setIsLoading(false)
      setLoading(false);
    }
  }

  // helper to perform generation; optionally link to a requirementId
  async function doGenerate(linkRequirementId?: string) {
    setIsLoading(true);
    setLoading(true);
    try {
  const result = await callGenerateTestCases(requirementText, undefined, linkRequirementId);
      console.log("Backend generation result:", result);
      // Compute created/persisted count from multiple possible payload fields
      const persistedCount =
        (Array.isArray(result?._persistedIds) && result._persistedIds.length) ||
        (Array.isArray(result?.testCaseIds) && result.testCaseIds.length) ||
        (Array.isArray(result?.test_cases) && result.test_cases.length) ||
        (Array.isArray(result?.testCases) && result.testCases.length) ||
        (typeof result?._maybeCasesCount === 'number' && result._maybeCasesCount) ||
        (Array.isArray(result?.created) && result.created.length) ||
        0;

      toast({
        title: "Success!",
        description: `${persistedCount} test case${persistedCount === 1 ? '' : 's'} were generated and saved. Redirecting...`,
      });
      router.push("/test-cases");
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "Failed to generate test cases. Please try again.",
      });
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  }

  const handleComplianceChange = (standard: string) => {
    setComplianceStandards(prev => 
      prev.includes(standard) 
        ? prev.filter(s => s !== standard)
        : [...prev, standard]
    )
  }


  return (
    <div className="grid gap-8">
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center gap-4">
                  <FileText className="h-8 w-8" />
                  <div>
                    <CardTitle>Generate Test Cases</CardTitle>
                    <CardDescription>
                        Upload a requirement document or paste the text below to generate test cases with AI.
                    </CardDescription>
                  </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label>Upload Requirement Document</Label>
                    <div
                        className={`mt-2 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors ${
                        isDragging ? "border-primary bg-accent" : "border-border"
                        }`}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <Inbox className="w-12 h-12 text-muted-foreground" />
                        <p className="mt-4 text-center text-muted-foreground">
                        Drag & drop files here, or click to select files
                        </p>
                        <div className="relative mt-4">
                        <Button variant="outline">
                            <Upload className="mr-2 h-4 w-4" />
                            Select Files
                        </Button>
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                            multiple={false}
                            accept=".txt,.md"
                        />
                        </div>
                    </div>
                    {files.length > 0 && (
                        <div className="mt-4">
                        <h4 className="font-medium">Selected File:</h4>
                        <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground">
                            {files.map((file, index) => (
                            <li key={index}>{file.name}</li>
                            ))}
                        </ul>
                        </div>
                    )}
                </div>

                <div className="flex items-center">
                    <Separator className="flex-1" />
                    <span className="mx-4 text-xs text-muted-foreground">
                        OR
                    </span>
                    <Separator className="flex-1" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="requirement-text">Enter Requirement Text</Label>
                    <Textarea
                        id="requirement-text"
                        placeholder="Paste your requirement text here..."
                        rows={8}
                        value={requirementText}
                        onChange={(e) => setRequirementText(e.target.value)}
                        disabled={isLoading}
                    />
                </div>
                
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <ShieldCheck className="h-8 w-8" />
                    <div>
                        <CardTitle>Customize Generation (Coming Soon)</CardTitle>
                        <CardDescription>
                            Tailor the AI's output to your specific needs. This step is optional.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="prompt">Custom Prompt</Label>
                    <Textarea
                        id="prompt"
                        placeholder="e.g., Focus on security testing for user authentication..."
                        rows={3}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={true}
                    />
                </div>
                <div className="space-y-3">
                    <Label>Compliance Standards</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {complianceStandardsOptions.map(standard => (
                            <div key={standard} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={standard.toLowerCase()} 
                                    onCheckedChange={() => handleComplianceChange(standard)}
                                    checked={complianceStandards.includes(standard)}
                                    disabled={true}
                                />
                                <Label htmlFor={standard.toLowerCase()} className="font-normal text-muted-foreground">{standard}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button className="flex-1" onClick={handleGenerateClick} disabled={isLoading}>
            <Wand2 className="mr-2 h-4 w-4" />
            {isLoading ? "Generating..." : "Generate with AI"}
          </Button>
          {existingRequirementId && coverageInfo && (
            <div className="px-3 py-2 rounded-md border text-xs flex flex-col items-start min-w-[120px]">
              <span className="font-medium">Coverage</span>
              <span>{coverageInfo.count} test case{coverageInfo.count===1?'':'s'}</span>
              <span className="uppercase tracking-wide text-[10px] opacity-70">{coverageInfo.status}</span>
            </div>
          )}
        </div>
            {/* Existing requirement modal */}
            <Dialog open={existingModalOpen} onOpenChange={setExistingModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Existing Test Cases Found</DialogTitle>
                  <DialogDescription>Test cases already exist for this requirement. You can view them or continue to generate additional cases.</DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <TestCaseList testCases={existingTestCasesList} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setExistingModalOpen(false)}>Close</Button>
                  <Button onClick={() => { setExistingModalOpen(false); doGenerate(existingRequirementId || undefined); }}>Continue and generate</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Check-failed modal (index required / couldn't run dedupe) */}
            <Dialog open={checkFailedModalOpen} onOpenChange={setCheckFailedModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Could not check for existing test cases</DialogTitle>
                  <DialogDescription>
                    The system was unable to verify whether test cases already exist for this requirement because Firestore needs a composite index or the server lacks permission.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-2">
                  {checkFailedIndexUrl && (
                    <p className="text-sm">You can create the required index here: <a className="text-blue-600 underline" href={checkFailedIndexUrl} target="_blank" rel="noreferrer">Open Console</a></p>
                  )}
                  <p className="text-sm">Would you like to continue generating test cases anyway? This may create duplicates.</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCheckFailedModalOpen(false)}>Cancel</Button>
                  <Button onClick={() => { setCheckFailedModalOpen(false); doGenerate(); }}>Continue and generate</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
    </div>
  )
}

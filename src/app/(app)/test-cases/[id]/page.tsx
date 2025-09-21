
"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  PlusCircle,
  FileText,
  FlaskConical,
  ClipboardList,
  Shield,
  Gauge,
  Tags,
  Workflow,
  Wand2,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TestCase } from "@/lib/data"
import { doc, getDoc, updateDoc, getFirestore } from "firebase/firestore"
import { app } from "@/lib/firebase"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import TraceabilityPanel from '@/components/TraceabilityPanel'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog'
import { updateTestCase } from "@/ai/flows/update-test-case"
import { sendToJira } from '@/ai/flows/send-to-jira'

export default function TestCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); 
  const router = useRouter();
  const { toast } = useToast();
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Local state for edits
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [expectedResults, setExpectedResults] = useState("");
  const [postconditions, setPostconditions] = useState("");
  const [status, setStatus] = useState<TestCase['status']>('generated');
  const [priority, setPriority] = useState<TestCase['priority']>('Medium');
  const [severity, setSeverity] = useState<TestCase['severity']>('Medium');
  const [testData, setTestData] = useState("");
  const [environment, setEnvironment] = useState("");
  const [automationFeasible, setAutomationFeasible] = useState(false);
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [jiraIssueKey, setJiraIssueKey] = useState("");

  const [standardReferences, setStandardReferences] = useState<string[]>([]);
  const [evidenceNeeded, setEvidenceNeeded] = useState<string[]>([]);

  // AI Update state
  const [isUpdatingWithAI, setIsUpdatingWithAI] = useState(false);
  const [aiUpdatePrompt, setAiUpdatePrompt] = useState("");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);


  const fetchTestCase = async () => {
      setLoading(true);
      const db = getFirestore(app);
      const testCaseRef = doc(db, "testCases", id);
      const docSnap = await getDoc(testCaseRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as TestCase;
      setTestCase(data);
      setTitle(data.title || "");
      setDescription(data.description || "");
      setPreconditions(data.preconditions || "");
      setSteps(data.test_steps || data.steps || []);
      setExpectedResults(data.expected_results || data.expectedResults || "");
      setPostconditions(data.postconditions || "");
      setStatus(data.status || 'generated');
      setPriority(data.priority || 'Medium');
      setSeverity(data.severity || 'Medium');
      setTestData(data.test_data || "");
      setEnvironment(data.environment || "");
      setAutomationFeasible(data.automation_feasible || false);
      setEstimatedDuration(data.estimated_duration || "");
      setJiraIssueKey(data.jiraIssueKey || "");
      setStandardReferences((data as any).standard_references || []);
      setEvidenceNeeded((data as any).evidence_needed || []);
    } else {
          setTestCase(null);
      }
      setLoading(false);
  };


  useEffect(() => {
    if (!id) return;
    fetchTestCase();
  }, [id]);


  if (loading) {
    return <div>Loading...</div>
  }
  
  if (!testCase) {
    return <div>Test case not found</div>
  }

  const handleAddStep = () => {
    setSteps([...steps, ""])
  }

  const handleRemoveStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index)
    setSteps(newSteps)
  }

  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...steps]
    newSteps[index] = value
    setSteps(newSteps)
  }
  
  const handleSaveChanges = async () => {
     if (!id) return;
     const db = getFirestore(app);
     const testCaseRef = doc(db, "testCases", id);
     try {
        // If user marked status as in_jira but no jiraIssueKey exists, create a Jira ticket
        if (status === 'in_jira' && !jiraIssueKey) {
          try {
            const result = await sendToJira({ testCaseId: id });
            if (result?.jiraIssueKey) {
              setJiraIssueKey(result.jiraIssueKey);
            }
          } catch (sjErr) {
            console.error('Send to Jira failed:', sjErr);
            toast({ variant: 'destructive', title: 'Jira Error', description: String((sjErr as any)?.message || sjErr) });
            // continue to save other changes even if Jira fails
          }
        }
        await updateDoc(testCaseRef, {
            title,
            description,
            preconditions,
            test_steps: steps,
            expected_results: expectedResults,
            postconditions,
            status,
            priority,
            severity,
            test_data: testData,
            environment,
            automation_feasible: automationFeasible,
            estimated_duration: estimatedDuration,
            jiraIssueKey,
        standard_references: standardReferences,
        evidence_needed: evidenceNeeded,
        });
        toast({ title: "Success", description: "Changes saved successfully!" });
     } catch (error) {
        console.error("Error saving changes: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to save changes." });
     }
  }

  const handleAiUpdate = async () => {
    if (!aiUpdatePrompt.trim() || !id) return;
    setIsUpdatingWithAI(true);
    try {
      toast({ title: "AI is updating...", description: "Please wait while the AI works its magic." });
      const result = await updateTestCase({
        testCaseId: id,
        prompt: aiUpdatePrompt,
      });

      if (result.success) {
        toast({ title: "Success!", description: "Test case updated by AI." });
        // Refetch data to show updates
        await fetchTestCase(); 
      } else {
         throw new Error("AI update flow failed to complete.");
      }
    } catch (error: any) {
      console.error("Error updating with AI:", error);
      toast({ variant: "destructive", title: "AI Update Failed", description: error.message || "An unexpected error occurred." });
    } finally {
      setIsUpdatingWithAI(false);
      setIsAIModalOpen(false);
      setAiUpdatePrompt("");
    }
  };


  return (
    <div className="mx-auto grid max-w-[64rem] flex-1 auto-rows-max gap-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-7 w-7" asChild>
          <Link href="/test-cases">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div className="flex-1">
            <h1 className="shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
            {title}
            </h1>
            <p className="text-sm text-muted-foreground">{testCase.test_case_id || id}</p>
        </div>
        <div className="items-center gap-2 md:ml-auto flex">
          <Dialog open={isAIModalOpen} onOpenChange={setIsAIModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Wand2 className="h-4 w-4 mr-2" />
                Update with AI
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Test Case with AI</DialogTitle>
                <DialogDescription>
                  Enter a prompt to tell the AI how to update this test case.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea
                  placeholder="e.g., 'Add more steps for negative testing' or 'Rewrite the description to be more concise.'"
                  value={aiUpdatePrompt}
                  onChange={(e) => setAiUpdatePrompt(e.target.value)}
                  rows={4}
                  disabled={isUpdatingWithAI}
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsAIModalOpen(false)} disabled={isUpdatingWithAI}>Cancel</Button>
                <Button onClick={handleAiUpdate} disabled={isUpdatingWithAI || !aiUpdatePrompt.trim()}>
                  {isUpdatingWithAI ? "Updating..." : "Submit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" asChild>
            <Link href="/test-cases">Discard</Link>
          </Button>
          <Button size="sm" onClick={handleSaveChanges}>Save</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
        <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
          <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5"/>
                    <CardTitle>Test Case Details</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    type="text"
                    className="w-full"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-24"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5"/>
                    <CardTitle>Execution Plan</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid gap-3">
                  <Label htmlFor="preconditions">Preconditions</Label>
                  <Textarea
                    id="preconditions"
                    value={preconditions}
                    onChange={(e) => setPreconditions(e.target.value)}
                    className="min-h-20"
                  />
                </div>
              <div className="grid gap-4">
                 <Label>Test Steps</Label>
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Label htmlFor={`step-${index}`} className="w-8 text-muted-foreground">{index + 1}.</Label>
                    <Input
                      id={`step-${index}`}
                      type="text"
                      className="w-full"
                      value={step}
                      onChange={(e) => handleStepChange(index, e.target.value)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveStep(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={handleAddStep} className="mt-2">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
               <div className="grid gap-3">
                  <Label htmlFor="expected-results">Expected Results</Label>
                  <Textarea
                    id="expected-results"
                    value={expectedResults}
                    onChange={(e) => setExpectedResults(e.target.value)}
                    className="min-h-20"
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="postconditions">Postconditions</Label>
                  <Textarea
                    id="postconditions"
                    value={postconditions}
                    onChange={(e) => setPostconditions(e.target.value)}
                    className="min-h-20"
                  />
                </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
          <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Workflow className="h-5 w-5"/>
                    <CardTitle>Status & Priority</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as TestCase['status'])}>
                    <SelectTrigger id="status" aria-label="Select status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generated" disabled={status !== 'generated'}>Generated</SelectItem>
                      <SelectItem value="under_review" disabled={status !== 'generated'}>Under Review</SelectItem>
                      <SelectItem value="approved" disabled={status !== 'under_review'}>Approved</SelectItem>
                      <SelectItem value="in_jira" disabled={status !== 'approved'}>In Jira</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as TestCase['priority'])}>
                    <SelectTrigger id="priority" aria-label="Select priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="severity">Severity</Label>
                  <Select value={severity} onValueChange={(value) => setSeverity(value as TestCase['severity'])}>
                    <SelectTrigger id="severity" aria-label="Select severity">
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
             <CardHeader>
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5"/>
                    <CardTitle>Execution Details</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-3">
                  <Label htmlFor="test-data">Test Data</Label>
                  <Textarea
                    id="test-data"
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    className="min-h-20"
                  />
                </div>
                 <div className="grid gap-3">
                  <Label htmlFor="environment">Environment</Label>
                  <Input
                    id="environment"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                  />
                </div>
                 <div className="grid gap-3">
                  <Label htmlFor="estimated-duration">Estimated Duration</Label>                  <Input
                    id="estimated-duration"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                  />
                </div>
                 <div className="flex items-center space-x-2">
                    <Switch id="automation-feasible" checked={automationFeasible} onCheckedChange={setAutomationFeasible} />
                    <Label htmlFor="automation-feasible">Automation Feasible</Label>
                </div>
                 <div className="grid gap-3">
                    <Label htmlFor="jira-issue">Jira Issue Key</Label>
                    <Input
                        id="jira-issue"
                        value={jiraIssueKey}
                        onChange={(e) => setJiraIssueKey(e.target.value)}
                        placeholder="e.g., HTA-123"
                    />
                </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5"/>
                    <CardTitle>Compliance & Risk</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-3">
                  <Label>Compliance Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {(testCase.compliance_tags || testCase.complianceTags)?.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
                  <div className="grid gap-3">
                    <Label>Standard References</Label>
                    <div className="flex flex-wrap gap-2">
                      {standardReferences && standardReferences.length > 0 ? standardReferences.map((s) => (
                        <Badge key={s} variant="outline">{s}</Badge>
                      )) : <div className="text-sm text-muted-foreground">None</div>}
                    </div>
                    <Textarea
                      placeholder="One per line or comma-separated"
                      value={standardReferences.join('\n')}
                      onChange={(e) => setStandardReferences(e.target.value.split(/\n|,\s*/).map(x => x.trim()).filter(Boolean))}
                      className="min-h-20"
                    />
                  </div>
                  <div className="grid gap-3">
                    <Label>Evidence Needed</Label>
                    <div className="flex flex-wrap gap-2">
                      {evidenceNeeded && evidenceNeeded.length > 0 ? evidenceNeeded.map((s) => (
                        <Badge key={s} variant="secondary">{s}</Badge>
                      )) : <div className="text-sm text-muted-foreground">None</div>}
                    </div>
                    <Textarea
                      placeholder="One per line or comma-separated"
                      value={evidenceNeeded.join('\n')}
                      onChange={(e) => setEvidenceNeeded(e.target.value.split(/\n|,\s*/).map(x => x.trim()).filter(Boolean))}
                      className="min-h-20"
                    />
                  </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label><Gauge className="h-4 w-4 inline mr-1"/> Risk Level</Label>
                        <Badge variant="outline" className="w-fit">{testCase.risk_level || 'N/A'}</Badge>
                    </div>
                    <div className="grid gap-2">
                        <Label><Tags className="h-4 w-4 inline mr-1"/> IEC 62304</Label>
                        <Badge variant="outline" className="w-fit">Class {testCase.iec_62304_class || 'N/A'}</Badge>
                    </div>
                </div>
                 <div className="grid gap-3">
                  <Label>Traceability</Label>
                  <Textarea
                    id="traceability"
                    value={testCase.traceability}
                    className="min-h-24 text-xs bg-muted"
                    readOnly
                  />
                </div>
                {/* UI panel that shows generation prompt, model used and a snippet of model output */}
                <div>
                  {/* TraceabilityPanel fetches traceability/{testCaseId} and renders metadata */}
                  {/* @ts-ignore server -> client id prop cast */}
                  <TraceabilityPanel testCaseId={id} />
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 md:hidden">
          <Button variant="outline" size="sm" asChild>
            <Link href="/test-cases">Discard</Link>
          </Button>
          <Button size="sm" onClick={handleSaveChanges}>Save</Button>
        </div>
    </div>
  )
}

    

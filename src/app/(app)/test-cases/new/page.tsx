
"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  PlusCircle,
  Trash2,
  FileText,
  FlaskConical,
  ClipboardList,
  Shield,
  Gauge,
  Tags,
  Workflow
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
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { app, db } from "@/lib/firebase"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function NewTestCasePage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Local state for edits
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);
  const [expectedResults, setExpectedResults] = useState("");
  const [postconditions, setPostconditions] = useState("");
  const [status, setStatus] = useState<TestCase['status']>('generated');
  const [priority, setPriority] = useState<TestCase['priority']>('Medium');
  const [severity, setSeverity] = useState<TestCase['severity']>('Medium');
  const [testData, setTestData] = useState("");
  const [environment, setEnvironment] = useState("");
  const [automationFeasible, setAutomationFeasible] = useState(false);
  const [estimatedDuration, setEstimatedDuration] = useState("");


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
     try {
        const newTestCase = {
            title,
            description,
            preconditions,
            steps,
            expectedResults,
            postconditions,
            status,
            priority,
            severity,
            test_data: testData,
            environment,
            automation_feasible: automationFeasible,
            estimated_duration: estimatedDuration,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, "testCases"), newTestCase);
        
        toast({ title: "Success", description: "New test case created successfully!" });
        router.push("/test-cases");
     } catch (error) {
        console.error("Error saving new test case: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to create new test case." });
     }
  }

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
                New Test Case
            </h1>
        </div>
        <div className="hidden items-center gap-2 md:ml-auto md:flex">
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
                      <SelectItem value="generated">Generated</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="in_jira">In Jira</SelectItem>
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
                  <Label htmlFor="estimated-duration">Estimated Duration</Label>
                  <Input
                    id="estimated-duration"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                  />
                </div>
                 <div className="flex items-center space-x-2">
                    <Switch id="automation-feasible" checked={automationFeasible} onCheckedChange={setAutomationFeasible} />
                    <Label htmlFor="automation-feasible">Automation Feasible</Label>
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

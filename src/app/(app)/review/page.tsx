
"use client"

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TestCase } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
import { useState, useEffect } from "react";
import { useTestCases } from "@/hooks/useTestCases";
import { doc, updateDoc, getFirestore, getDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";
import { sendToJira } from "@/ai/flows/send-to-jira";
import { useToast } from "@/hooks/use-toast";


type KanbanColumnProps = {
  title: string;
  status: TestCase['status'];
  cases: TestCase[];
  onDrop: (testCaseId: string, newStatus: TestCase['status']) => void;
  onUpdate: (testCaseId: string, updates: Partial<TestCase>) => void;
};

function getPriorityVariant(priority?: TestCase['priority']) {
    switch(priority) {
        case 'High': return 'destructive';
        case 'Medium': return 'secondary';
        case 'Low': return 'outline'
        default: return 'outline'
    }
  }

const KanbanColumn = ({ title, status, cases, onDrop, onUpdate }: KanbanColumnProps) => {
  const filteredCases = cases.filter((tc) => tc.status === status);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const testCaseId = e.dataTransfer.getData("testCaseId");
    onDrop(testCaseId, status);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-lg font-semibold capitalize">{title.replace('_', ' ')}</h2>
        <Badge variant="secondary">{filteredCases.length}</Badge>
      </div>
      <div 
        className="flex flex-col gap-4 h-full rounded-lg bg-muted/50 p-4"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {filteredCases.map((tc) => (
          <KanbanCard key={tc.id} testCase={tc} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
};

const KanbanCard = ({ testCase, onUpdate }: { testCase: TestCase, onUpdate: KanbanColumnProps['onUpdate'] }) => {
  const { toast } = useToast();

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("testCaseId", testCase.id);
  };

  const handleSendToJira = async () => {
     try {
      toast({ title: "Sending to Jira...", description: `Sending test case ${testCase.id}.` });
      const result = await sendToJira({ testCaseId: testCase.id });
      onUpdate(testCase.id, { jiraIssueKey: result.jiraIssueKey, status: 'in_jira' });
      toast({ title: "Success!", description: `Test case sent to Jira. Issue key: ${result.jiraIssueKey}` });
    } catch (error: any) {
      console.error("Error sending to Jira: ", error);
      toast({ variant: "destructive", title: "Jira Error", description: error.message || "Failed to send to Jira." });
    }
  }
  
  return (
    <Card 
      draggable="true"
      onDragStart={handleDragStart}
      className="cursor-grab active:cursor-grabbing"
    >
      <CardHeader className="p-4 flex flex-row items-center justify-between">
        <Link href={`/test-cases/${testCase.id}`} className="font-semibold hover:underline">{testCase.title}</Link>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4"/>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                    <Link href={`/test-cases/${testCase.id}`}>Edit</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSendToJira} disabled={testCase.status !== 'approved'}>
                  Send to Jira
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">{testCase.id}</p>
            {testCase.jiraIssueKey && (
              <a 
                href={`#`} // Replace with actual Jira instance URL
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                {testCase.jiraIssueKey}
              </a>
            )}
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant={getPriorityVariant(testCase.priority)}>{testCase.priority}</Badge>
            {testCase.classificationTags?.slice(0, 1).map(tag => (
                <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
          <Avatar className="h-6 w-6">
            <AvatarImage src={`https://picsum.photos/seed/${testCase.reviewedBy || 'user'}/40/40`} data-ai-hint="user avatar" />
            <AvatarFallback>{(testCase.reviewedBy || "U").substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
      </CardContent>
    </Card>
  );
};

export default function ReviewPage() {
    const { testCases: initialCases, loading } = useTestCases(null); // Fetch all test cases
    const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
    const [statuses, setStatuses] = useState<TestCase['status'][]>(['generated', 'under_review', 'approved', 'in_jira']);
    const { toast } = useToast();

    useEffect(() => {
        setAllTestCases(initialCases);
    }, [initialCases]);

    const handleUpdateTestCase = (testCaseId: string, updates: Partial<TestCase>) => {
        setAllTestCases(prevCases => 
            prevCases.map(tc => 
                tc.id === testCaseId ? { ...tc, ...updates } : tc
            )
        );
    };

    const handleDrop = async (testCaseId: string, newStatus: TestCase['status']) => {
        const testCase = allTestCases.find(tc => tc.id === testCaseId);
        if (!testCase) return;

        const currentStatus = testCase.status;
        const allowedTransitions: Record<TestCase['status'], TestCase['status'][]> = {
            generated: ['under_review'],
            under_review: ['approved'],
            approved: ['in_jira'],
            in_jira: []
        };

        if (allowedTransitions[currentStatus] && !allowedTransitions[currentStatus].includes(newStatus)) {
            toast({
                variant: "destructive",
                title: "Invalid Status Change",
                description: `Cannot move from "${currentStatus.replace('_', ' ')}" to "${newStatus.replace('_', ' ')}".`
            });
            return;
        }

        // Optimistic UI update
        const originalCases = allTestCases;
        handleUpdateTestCase(testCaseId, { status: newStatus });

        // Update in Firestore
        try {
            const db = getFirestore(app);
            const testCaseRef = doc(db, "testCases", testCaseId);
            // If moving to in_jira, attempt to create a Jira ticket first (if not present)
            if (newStatus === 'in_jira') {
              // fetch existing doc to check jiraIssueKey (client SDK)
              const snap = await getDoc(testCaseRef as any);
              const existing = snap.exists() ? (snap.data() as TestCase) : null;
              if (!existing?.jiraIssueKey) {
                try {
                  const res = await sendToJira({ testCaseId });
                  await updateDoc(testCaseRef, { status: newStatus, jiraIssueKey: res.jiraIssueKey });
                } catch (err) {
                  console.error('Failed to create Jira ticket on move:', err);
                  // fallback: still update status but log error
                  await updateDoc(testCaseRef, { status: newStatus });
                }
              } else {
                await updateDoc(testCaseRef, { status: newStatus });
              }
            } else {
              await updateDoc(testCaseRef, { status: newStatus });
            }
        } catch (error) {
            console.error("Failed to update test case status:", error);
            // Revert UI if Firestore update fails
            setAllTestCases(originalCases); 
            toast({ variant: "destructive", title: "Update Failed", description: "Could not update status. Please try again." });
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statuses.map(status => (
                    <div key={status} className="flex flex-col gap-4">
                        <h2 className="text-lg font-semibold capitalize text-center">{status.replace('_', ' ')}</h2>
                        <div className="flex flex-col gap-4 h-full rounded-lg bg-muted/50 p-4">
                            <div className="h-24 bg-muted rounded-lg animate-pulse" />
                            <div className="h-24 bg-muted rounded-lg animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statuses.map(status => (
           <KanbanColumn 
                key={status}
                title={status.replace('_', ' ')} 
                status={status} 
                cases={allTestCases} 
                onDrop={handleDrop} 
                onUpdate={handleUpdateTestCase}
            />
        ))}
      </div>
    </div>
  );
}

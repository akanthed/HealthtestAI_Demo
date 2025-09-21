

"use client"

import { useEffect, useState, useMemo } from "react"
    import {
        File,
        ListFilter,
        MoreHorizontal,
        PlusCircle,
        Search,
    } from "lucide-react"
    import { Trash2 } from "lucide-react"
  
  import { Badge } from "@/components/ui/badge"
  import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
  import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs"
  import { Button } from "@/components/ui/button"
  import { db } from "@/lib/firebase"
  import { doc, deleteDoc, writeBatch } from "firebase/firestore"
  import { TestCase } from "@/lib/data"
  import Link from "next/link"
import { useTestCases } from "@/hooks/useTestCases"
import { Checkbox } from "@/components/ui/checkbox"
import { sendToJira } from "@/ai/flows/send-to-jira"
import { useToast } from "@/hooks/use-toast"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
  
  function getStatusVariant(status: TestCase['status']) {
    switch(status) {
        case 'approved': return 'default';
        case 'in_jira': return 'outline';
        case 'under_review': return 'secondary';
        case 'generated': return 'destructive';
        default: return 'outline'
    }
  }

  function getPriorityVariant(priority?: TestCase['priority']) {
    switch(priority) {
        case 'High': return 'destructive';
        case 'Medium': return 'secondary';
        case 'Low': return 'outline'
        default: return 'outline';
    }
  }

const TestCaseTable = ({ 
    cases, 
    isLoading,
    selectedTestCases,
    onSelectionChange,
    onUpdate,
    searchQuery,
    onSearchChange,
}: { 
    cases: TestCase[], 
    isLoading?: boolean,
    selectedTestCases: string[],
    onSelectionChange: (ids: string[]) => void,
    onUpdate: (testCaseId: string, updates: Partial<TestCase>) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}) => {
    const { toast } = useToast();
    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        onSelectionChange(checked ? cases.map(c => c.id) : []);
    };
    
    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelection = checked 
            ? [...selectedTestCases, id] 
            : selectedTestCases.filter(selectedId => selectedId !== id);
        onSelectionChange(newSelection);
    }

    const handleSendToJira = async (testCaseId: string) => {
        const testCase = cases.find(c => c.id === testCaseId);
        if (!testCase || testCase.status !== 'approved') {
             toast({ variant: "destructive", title: "Action Failed", description: "Only approved test cases can be sent to Jira." });
            return;
        }

        try {
            toast({ title: "Sending to Jira...", description: `Sending test case ${testCaseId}.` });
            const result = await sendToJira({ testCaseId });
            onUpdate(testCaseId, { jiraIssueKey: result.jiraIssueKey, status: 'in_jira' });
            toast({ title: "Success!", description: `Test case sent to Jira. Issue key: ${result.jiraIssueKey}` });
        } catch (error: any) {
            console.error("Error sending to Jira: ", error);
            toast({ variant: "destructive", title: "Jira Error", description: error.message || "Failed to send to Jira." });
        }
    }

    if (isLoading) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Test Cases</CardTitle>
                    <CardDescription>
                    Manage and review all generated test cases.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="h-10 bg-muted rounded-md animate-pulse" />
                        <div className="h-10 bg-muted rounded-md animate-pulse" />
                        <div className="h-10 bg-muted rounded-md animate-pulse" />
                    </div>
                </CardContent>
             </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                    <CardTitle>Test Cases</CardTitle>
                    <CardDescription>
                    Manage and review all generated test cases.
                    </CardDescription>
                </div>
                 <div className="relative flex-1 md:grow-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search test cases..."
                        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[40px]">
                            <Checkbox 
                                onCheckedChange={(checked) => handleSelectAll(checked === 'indeterminate' ? false : !!checked)}
                                checked={
                                    cases.length > 0 && selectedTestCases.length === cases.length
                                        ? true
                                        : selectedTestCases.length > 0
                                        ? 'indeterminate'
                                        : false
                                }
                                aria-label="Select all"
                            />
                        </TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead className="hidden md:table-cell">Compliance</TableHead>
                         <TableHead className="hidden md:table-cell">
                            Jira Issue
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                            Created at
                        </TableHead>
                        <TableHead>
                            <span className="sr-only">Actions</span>
                        </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cases.map((testCase) => (
                        <TableRow key={testCase.id} data-state={selectedTestCases.includes(testCase.id) && "selected"}>
                             <TableCell>
                                <Checkbox 
                                    onCheckedChange={(checked) => handleSelectRow(testCase.id, checked === 'indeterminate' ? false : !!checked)}
                                    checked={selectedTestCases.includes(testCase.id)}
                                    aria-label={`Select test case ${testCase.id}`}
                                />
                            </TableCell>
                            <TableCell className="font-medium">{testCase.id}</TableCell>
                            <TableCell className="font-medium">{testCase.title}</TableCell>
                            <TableCell>
                            <Badge variant={getStatusVariant(testCase.status)} className="capitalize">{testCase.status.replace('_', ' ')}</Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={getPriorityVariant(testCase.priority)}>{testCase.priority}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <div className="flex flex-wrap gap-1">
                                    {(testCase.complianceTags || []).map((tag: string) => (
                                        <Badge key={tag} variant="outline">{tag}</Badge>
                                    ))}
                                </div>
                            </TableCell>
                             <TableCell className="hidden md:table-cell">
                                {testCase.jiraIssueKey ? (
                                    <a href="#" className="text-blue-600 hover:underline">{testCase.jiraIssueKey}</a>
                                ) : (
                                    <span className="text-muted-foreground">N/A</span>
                                )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                {testCase.createdAt ? new Date(testCase.createdAt).toLocaleDateString() : 'N/A'}
                            </TableCell>
                            <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button
                                    aria-haspopup="true"
                                    size="icon"
                                    variant="ghost"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                    <Link href={`/test-cases/${testCase.id}`}>Edit</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendToJira(testCase.id)} disabled={testCase.status !== 'approved'}>
                                    Send to Jira
                                </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter>
                <div className="text-xs text-muted-foreground">
                Showing <strong>1-{cases.length > 10 ? 10 : cases.length}</strong> of <strong>{cases.length}</strong>{" "}
                test cases
                </div>
            </CardFooter>
        </Card>
    )
};


  export default function TestCasesPage() {
    const { testCases, loading } = useTestCases(null); // Fetch all
    const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
    const [activeTab, setActiveTab] = useState("all");
    const [selectedTestCases, setSelectedTestCases] = useState<string[]>([]);
    const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();

     useEffect(() => {
        setAllTestCases(testCases);
    }, [testCases]);

    const handleUpdateTestCase = (testCaseId: string, updates: Partial<TestCase>) => {
        setAllTestCases(prevCases => 
            prevCases.map(tc => 
                tc.id === testCaseId ? { ...tc, ...updates } : tc
            )
        );
    };

    const casesForCurrentTab = useMemo(() => {
        const tabFiltered = (() => {
            switch (activeTab) {
                case "generated":
                    return allTestCases.filter(tc => tc.status === "generated");
                case "under_review":
                    return allTestCases.filter(tc => tc.status === "under_review");
                case "approved":
                    return allTestCases.filter(tc => tc.status === "approved");
                case "in_jira":
                    return allTestCases.filter(tc => tc.status === "in_jira");
                case "all":
                default:
                    return allTestCases;
            }
        })();
        
        const priorityFiltered = priorityFilters.length === 0
            ? tabFiltered
            : tabFiltered.filter(tc => tc.priority && priorityFilters.includes(tc.priority));

        if (!searchQuery.trim()) {
            return priorityFiltered;
        }

        const lowercasedQuery = searchQuery.toLowerCase();
        return priorityFiltered.filter(tc => 
            tc.id.toLowerCase().includes(lowercasedQuery) || 
            tc.title.toLowerCase().includes(lowercasedQuery)
        );

    }, [activeTab, allTestCases, priorityFilters, searchQuery]);

    // Reset selection when tab changes
    useEffect(() => {
        setSelectedTestCases([]);
    }, [activeTab, priorityFilters]);

    const handleDeleteSelected = async () => {
        if (selectedTestCases.length === 0) return;
        
        try {
                const { auth } = await import('@/lib/firebase');
                if (!auth || !auth.currentUser) {
                    toast({ variant: "destructive", title: "Not Authenticated", description: "You must be signed in to delete test cases." });
                    return;
                }

                const batch = writeBatch(db);
                selectedTestCases.forEach(id => {
                    const docRef = doc(db, 'testCases', id);
                    batch.delete(docRef);
                });
                
                await batch.commit();

                toast({
                    title: "Success!",
                    description: `${selectedTestCases.length} test case(s) deleted successfully.`,
                });
                
                setAllTestCases(prev => prev.filter(tc => !selectedTestCases.includes(tc.id)));
                setSelectedTestCases([]); 
        } catch (err) {
            const _err: any = err;
            console.error('Failed to delete selected test cases', err);
            toast({
                variant: "destructive",
                title: "Deletion Error",
                description: _err?.message || "An unexpected error occurred while deleting."
            });
        }
    };
    
    const handlePriorityFilterChange = (priority: string, checked: boolean) => {
        setPriorityFilters(prev => 
            checked ? [...prev, priority] : prev.filter(p => p !== priority)
        );
    }
    
    const handleExport = () => {
        if (casesForCurrentTab.length === 0) {
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: "No test cases to export.",
            });
            return;
        }

        const headers = [
            "id", "title", "description", "status", "priority", "steps", 
            "expectedResults", "complianceTags", "createdAt", "jiraIssueKey"
        ];
        
        const csvRows = [headers.join(",")];

        casesForCurrentTab.forEach(tc => {
            const values = [
                tc.id,
                `"${(tc.title || '').replace(/"/g, '""')}"`,
                `"${(tc.description || '').replace(/"/g, '""')}"`,
                tc.status,
                tc.priority || '',
                `"${(tc.steps || []).join('; ')}"`,
                `"${(tc.expectedResults || '').replace(/"/g, '""')}"`,
                `"${(tc.complianceTags || []).join('; ')}"`,
                tc.createdAt ? new Date(tc.createdAt).toISOString() : '',
                tc.jiraIssueKey || ''
            ];
            csvRows.push(values.join(","));
        });

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `test_cases_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    return (
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="generated">Generated</TabsTrigger>
            <TabsTrigger value="under_review">In Review</TabsTrigger>
            <TabsTrigger value="approved" className="hidden sm:flex">
              Approved
            </TabsTrigger>
            <TabsTrigger value="in_jira" className="hidden sm:flex">
                In Jira
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={selectedTestCases.length === 0}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Delete ({selectedTestCases.length})
                        </span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete{" "}
                        {selectedTestCases.length} test case(s).
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSelected}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <ListFilter className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Filter
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem 
                    checked={priorityFilters.includes('High')}
                    onCheckedChange={(checked) => handlePriorityFilterChange('High', !!checked)}
                >
                  High Priority
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                    checked={priorityFilters.includes('Medium')}
                    onCheckedChange={(checked) => handlePriorityFilterChange('Medium', !!checked)}
                >
                  Medium Priority
                </DropdownMenuCheckboxItem>
                 <DropdownMenuCheckboxItem 
                    checked={priorityFilters.includes('Low')}
                    onCheckedChange={(checked) => handlePriorityFilterChange('Low', !!checked)}
                >
                  Low Priority
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleExport}>
              <File className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Export
              </span>
            </Button>
            <Button size="sm" className="h-8 gap-1" asChild>
              <Link href="/test-cases/new">
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Add Test Case
                </span>
              </Link>
            </Button>
          </div>
        </div>
        <TabsContent value={activeTab}>
            <TestCaseTable 
                cases={casesForCurrentTab} 
                isLoading={loading}
                selectedTestCases={selectedTestCases}
                onSelectionChange={setSelectedTestCases}
                onUpdate={handleUpdateTestCase}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
             />
        </TabsContent>
      </Tabs>
    )
  }
  

      


"use client"

import {
    Activity,
    ArrowUpRight,
    CircleUser,
    CreditCard,
    DollarSign,
    Menu,
    Package2,
    Search,
    Users,
    ClipboardCheck,
    FileText,
    CheckCircle,
    Clock
  } from "lucide-react"
  
  import {
    Avatar,
    AvatarFallback,
    AvatarImage,
  } from "@/components/ui/avatar"
  import { Badge } from "@/components/ui/badge"
  import { Button } from "@/components/ui/button"
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
  import Link from "next/link"
  import {
    Bar,
    BarChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
  } from "recharts"
  import { useTestCases } from "@/hooks/useTestCases"
  import { useEffect, useState } from "react"
  import { collection, getDocs } from "firebase/firestore"
  import { db } from "@/lib/firebase"
  import dynamic from 'next/dynamic';
  const AuditTrailModal = dynamic(() => import('@/components/audit/AuditTrailModal').then(m => m.default), { ssr: false });
  
  export default function DashboardPage() {
    const { testCases: allTestCases, loading: allLoading } = useTestCases(null, 1000); // Fetch all test cases for stats
    const { testCases: recentTestCases, loading: recentLoading } = useTestCases(null, 5); // Fetch 5 most recent test cases
    const [requirementCount, setRequirementCount] = useState(0);

    useEffect(() => {
        const fetchRequirementCount = async () => {
            const querySnapshot = await getDocs(collection(db, "requirements"));
            setRequirementCount(querySnapshot.size);
        };
        fetchRequirementCount();
    }, []);

    const totalTestCases = allTestCases.length;
    const approvedCount = allTestCases.filter(tc => tc.status === 'approved').length;
    const pendingReviewCount = allTestCases.filter(tc => tc.status === 'under_review').length;

    const statusData = [
        { name: "Generated", total: allTestCases.filter(tc => tc.status === 'generated').length, fill: "var(--color-generated)" },
        { name: "In Review", total: allTestCases.filter(tc => tc.status === 'under_review').length, fill: "var(--color-review)" },
        { name: "Approved", total: allTestCases.filter(tc => tc.status === 'approved').length, fill: "var(--color-approved)" },
        { name: "In Jira", total: allTestCases.filter(tc => tc.status === 'in_jira').length, fill: "var(--color-jira)" },
    ]
  
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <div className="flex gap-2">
            <AuditTrailModal />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Requirements
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requirementCount}</div>
              <p className="text-xs text-muted-foreground">
                in repository
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Test Cases
              </CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTestCases}</div>
               <p className="text-xs text-muted-foreground">
                across all requirements
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedCount}</div>
              <p className="text-xs text-muted-foreground">
                {totalTestCases > 0 ? `${Math.round((approvedCount / totalTestCases) * 100)}% approval rate` : "No test cases yet"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingReviewCount}</div>
              <p className="text-xs text-muted-foreground">
                waiting for SME review
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Test Case Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
               <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={statusData}>
                    <XAxis
                      dataKey="name"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                    <CardTitle>Recent Test Cases</CardTitle>
                    <CardDescription>
                        An overview of the most recently created test cases.
                    </CardDescription>
                </div>
                <Button asChild size="sm" className="ml-auto gap-1">
                    <Link href="/test-cases">
                        View All
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="grid gap-8">
                {recentLoading ? (
                    <p>Loading...</p>
                ) : (
                    recentTestCases.map((testCase) => (
                        <div className="flex items-center gap-4" key={testCase.id}>
                            <Avatar className="hidden h-9 w-9 sm:flex">
                                <AvatarFallback>{(testCase.id || "TC").substring(0,2)}</AvatarFallback>
                            </Avatar>
                            <div className="grid gap-1">
                                <p className="text-sm font-medium leading-none">
                                    {testCase.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {testCase.id}
                                </p>
                            </div>
                            <div className="ml-auto font-medium">
                                <Badge variant={
                                    testCase.status === 'approved' ? 'default' :
                                    testCase.status === 'under_review' ? 'secondary' :
                                    'outline'
                                }>{testCase.status.replace('_', ' ')}</Badge>
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

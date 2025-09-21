
"use client"

import { useMemo, useState } from "react"
import { Download, Calendar as CalendarIcon } from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Tooltip,
  Legend,
} from "recharts"
import { DateRange } from "react-day-picker"
import { addDays, format } from "date-fns"
import jsPDF from "jspdf"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useTestCases } from "@/hooks/useTestCases"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { generateEvidencePack } from "@/ai/flows/generate-evidence-pack"
import { toCanonicalTags } from '@/lib/standardsClient'
import { useToast } from "@/hooks/use-toast"

const complianceStandardsOptions = ["HIPAA", "FDA", "ISO 13485", "IEC 62304", "GDPR"]

export default function CompliancePage() {
  const { testCases, loading } = useTestCases(null, 1000) // Fetch all for stats
  const [selectedStandards, setSelectedStandards] = useState<string[]>([])
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()


  const handleStandardChange = (standard: string) => {
    setSelectedStandards(prev =>
      prev.includes(standard)
        ? prev.filter(s => s !== standard)
        : [...prev, standard]
    )
  }

  const handleGenerateEvidence = async () => {
    if (!date?.from || !date?.to) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Please select a valid date range.",
        })
        return;
    }
    setIsGenerating(true)
    try {
    // Convert friendly labels (e.g. 'HIPAA') to canonical tokens (e.g. 'HIPAA_164.312')
    const canonical = toCanonicalTags(selectedStandards);
    const result = await generateEvidencePack({
      standards: canonical,
            dateRange: {
                from: date.from.toISOString(),
                to: date.to.toISOString(),
            }
        });
        
        // Generate PDF
        const doc = new jsPDF();
        doc.text(result.report, 10, 10);
        doc.save(`evidence-pack-${new Date().toISOString().split('T')[0]}.pdf`);

        toast({
            title: "Success!",
            description: "Your evidence pack has been downloaded.",
        });

    } catch (error: any) {
        console.error("Failed to generate evidence pack:", error);
        toast({
            variant: "destructive",
            title: "Generation Failed",
            description: error.message || "An unexpected error occurred.",
        })
    } finally {
        setIsGenerating(false)
    }
  }


  const { complianceData, approvalData } = useMemo(() => {
    if (!testCases || testCases.length === 0) {
      return { complianceData: [], approvalData: [] }
    }

    // Calculate compliance standard coverage
    const complianceCounts: { [key: string]: number } = {}
    testCases.forEach(tc => {
      const tags = tc.complianceTags || (tc as any).compliance_tags || []
      tags.forEach(tag => {
        complianceCounts[tag] = (complianceCounts[tag] || 0) + 1
      })
    })

    const dynamicComplianceData = Object.entries(complianceCounts).map(([name, value]) => ({
      name,
      value,
    }))

    // Calculate approval rate
    const approvedCount = testCases.filter(tc => tc.status === 'approved').length
    const pendingCount = testCases.length - approvedCount
    const dynamicApprovalData = [
      { name: "Approved", value: approvedCount, fill: "hsl(var(--primary))" },
      { name: "Pending", value: pendingCount, fill: "hsl(var(--accent))" },
    ]

    return {
      complianceData: dynamicComplianceData,
      approvalData: dynamicApprovalData,
    }
  }, [testCases])

  if (loading) {
    return (
      <div className="grid gap-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="flex justify-center items-center">
              <Skeleton className="h-[200px] w-[200px] rounded-full" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-48" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-8">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Test Case Coverage by Standard</CardTitle>
            <CardDescription>
              Number of test cases associated with each compliance standard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={complianceData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'hsla(var(--muted))' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Standard
                              </span>
                              <span className="font-bold text-muted-foreground">
                                {payload[0].payload.name}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Test Cases
                              </span>
                              <span className="font-bold">
                                {payload[0].value}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Approval Rate</CardTitle>
            <CardDescription>
              The percentage of test cases that are approved.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={approvalData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {approvalData.map((entry, index) => (
                     <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                    />
                  ))}
                </Pie>
                <Legend />
                 <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                           <span className="font-bold">
                                {payload[0].value}
                           </span>
                           <span className="text-muted-foreground">
                                 {' '}{payload[0].name}
                           </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Evidence Pack Generator</CardTitle>
          <CardDescription>
            Generate and download compliance evidence packs in PDF format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
              <Label>Compliance Standards</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {complianceStandardsOptions.map(standard => (
                      <div key={standard} className="flex items-center space-x-2">
                          <Checkbox
                              id={standard.toLowerCase()}
                              onCheckedChange={() => handleStandardChange(standard)}
                              checked={selectedStandards.includes(standard)}
                          />
                          <Label htmlFor={standard.toLowerCase()} className="font-normal">{standard}</Label>
                      </div>
                  ))}
              </div>
          </div>

          <div className="space-y-3">
            <Label>Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button onClick={handleGenerateEvidence} disabled={isGenerating}>
            <Download className="mr-2 h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate Evidence Pack"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import { TraceabilityMatrix } from '@/components/audit/TraceabilityMatrix';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from '@/components/ui/button';


const AuditTrailModal = dynamic(() => import('@/components/audit/AuditTrailModal').then(m => m.default), { ssr: false });

export default function TraceabilityPage() {
  return (
    <div className="grid gap-6">
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>Requirement Traceability Matrix</CardTitle>
                    <CardDescription>
                        View and export the matrix linking requirements to test cases.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <Button asChild variant="outline" size="sm">
                        <a href="/api/traceability/export/csv" title="Download CSV">Export CSV</a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <a href="/api/traceability/export/pdf" title="Download PDF">Export PDF</a>
                    </Button>
                    <AuditTrailModal />
                </div>
            </CardHeader>
            <CardContent>
                <TraceabilityMatrix />
            </CardContent>
        </Card>
    </div>
  );
}

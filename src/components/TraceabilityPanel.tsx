"use client"

import { useEffect, useState } from 'react'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import { app } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function TraceabilityPanel({ testCaseId }: { testCaseId: string }) {
  const [loading, setLoading] = useState(true)
  const [trace, setTrace] = useState<any | null>(null)

  useEffect(() => {
    if (!testCaseId) return;
    const fetchTrace = async () => {
      setLoading(true)
      try {
        const db = getFirestore(app)
        const ref = doc(db, 'traceability', testCaseId)
        const snap = await getDoc(ref)
        if (snap.exists()) setTrace(snap.data())
        else setTrace(null)
      } catch (e) {
        console.warn('Failed fetching traceability', e)
        setTrace(null)
      } finally {
        setLoading(false)
      }
    }
    fetchTrace()
  }, [testCaseId])

  if (loading) return <div>Loading traceability…</div>
  if (!trace) return <div className="text-sm text-muted-foreground">No generation metadata available.</div>

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Generation Traceability</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Prompt</Label>
          <Textarea value={trace.generationPrompt || ''} readOnly className="min-h-20 text-sm" />
        </div>
        <div>
          <Label>Model</Label>
          <div className="text-sm text-muted-foreground">{JSON.stringify(trace.modelInfo || trace.model || 'N/A')}</div>
        </div>
        {trace.lastSnapshot ? (
          <div>
            <Label>Last Snapshot</Label>
            <div className="text-sm">Invocation: {trace.lastSnapshot.invocationId}</div>
            <div className="text-sm">Storage: {trace.lastSnapshot.storagePath}</div>
            <div className="text-sm">Checksum: <span className="font-mono text-xs">{trace.lastSnapshot.checksum}</span></div>
            {trace.lastSnapshot.signedUrl ? <a className="text-blue-600 underline" href={trace.lastSnapshot.signedUrl} target="_blank" rel="noreferrer">Download snapshot</a> : null}
          </div>
        ) : null}
        <div>
          <Label>Model Output Snippet</Label>
          <Textarea value={trace.rawModelResponseSnippet || ''} readOnly className="min-h-24 text-sm" />
        </div>
      </CardContent>
    </Card>
  )
}

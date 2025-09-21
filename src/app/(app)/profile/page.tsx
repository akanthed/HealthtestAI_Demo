"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ProfilePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          This is your profile page. You can edit your information here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>Profile editing functionality is coming soon!</p>
        <Button disabled>Update Profile</Button>
      </CardContent>
    </Card>
  )
}

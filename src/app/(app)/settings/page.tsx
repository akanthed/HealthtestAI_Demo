
"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Manage your account and notification settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            <div className="space-y-4">
                <h3 className="font-medium">User Profile</h3>
                 <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="Enter your full name" defaultValue="John Doe" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input id="role" readOnly disabled value="Subject Matter Expert" />
                </div>
            </div>
            
            <Separator />

            <div className="space-y-4">
                <h3 className="font-medium">Notification Settings</h3>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="assignment-notifications" className="text-base">Test Case Assignments</Label>
                        <p className="text-sm text-muted-foreground">
                            Receive an email when a test case is assigned to you for review.
                        </p>
                    </div>
                     <Switch
                        id="assignment-notifications"
                        defaultChecked
                      />
                </div>
                 <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="mention-notifications" className="text-base">Mentions</Label>
                        <p className="text-sm text-muted-foreground">
                           Receive an email when someone mentions you in a comment.
                        </p>
                    </div>
                     <Switch
                        id="mention-notifications"
                      />
                </div>
            </div>
            <Button disabled>Save Changes</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Connect to external tools like Jira, Polarion, and Azure DevOps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="jira">
              <AccordionTrigger>Jira Integration</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="jira-url">Jira Instance URL</Label>
                      <Input id="jira-url" placeholder="https://your-company.atlassian.net" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jira-project">Jira Project Key</Label>
                      <Input id="jira-project" placeholder="HTA" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jira-token">Personal Access Token</Label>
                      <Input id="jira-token" type="password" placeholder="Enter your Jira PAT" />
                      <p className="text-xs text-muted-foreground">
                        Your token will be stored securely and is only used for authentication.
                      </p>
                    </div>
                    <Button disabled>Save Jira Settings</Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="polarion">
              <AccordionTrigger>Polarion (Coming Soon)</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground pt-4">
                  Integration with Siemens Polarion ALM is planned for a future release.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="azure_devops">
              <AccordionTrigger>Azure DevOps (Coming Soon)</AccordionTrigger>
              <AccordionContent>
                 <p className="text-muted-foreground pt-4">
                  Integration with Microsoft Azure DevOps is planned for a future release.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}

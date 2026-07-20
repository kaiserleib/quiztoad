import { useAuth } from '../contexts/AuthContext'
import { Layout } from '@/components/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function Settings() {
  const { user, isAdmin, canGenerate } = useAuth()

  return (
    <Layout title="Settings" maxWidth="md" backTo="/">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your Quiztoad account and access level.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Generate with Claude</span>
            <Badge variant={canGenerate ? 'default' : 'secondary'}>
              {canGenerate ? 'Enabled' : 'Not enabled'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant={isAdmin ? 'default' : 'secondary'}>
              {isAdmin ? 'Admin' : 'Member'}
            </Badge>
          </div>
          {!canGenerate && (
            <p className="text-sm text-muted-foreground">
              "Generate with Claude" is managed by an admin. Ask an admin to enable
              it for your account.
            </p>
          )}
        </CardContent>
      </Card>
    </Layout>
  )
}

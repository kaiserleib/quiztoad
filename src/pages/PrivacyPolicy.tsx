import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Privacy Policy</CardTitle>
          <p className="text-sm text-muted-foreground">Last updated: February 25, 2026</p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-4 text-sm">
          <h2 className="text-lg font-semibold">1. Information We Collect</h2>
          <p>
            When you create an account, we collect the information you provide, including your email
            address. If you sign in with Google OAuth, we receive your name, email address, and
            profile picture from Google. We also store the trivia content you create within the
            application.
          </p>

          <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide and maintain your account</li>
            <li>Store and display your trivia content</li>
            <li>Authenticate your identity when you sign in</li>
            <li>Communicate with you about the service (e.g., magic link emails)</li>
          </ul>

          <h2 className="text-lg font-semibold">3. Data Storage</h2>
          <p>
            Your data is stored securely using Supabase, a hosted database platform. Your
            authentication credentials are managed by Supabase Auth and are never stored in
            plaintext. All data is transmitted over encrypted (HTTPS) connections.
          </p>

          <h2 className="text-lg font-semibold">4. Data Sharing</h2>
          <p>
            We do not sell, trade, or otherwise transfer your personal information to third parties.
            Your data is only shared with the following service providers as necessary to operate
            Quiztoad:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Supabase (authentication and data storage)</li>
            <li>Google (if you choose to sign in with Google OAuth)</li>
            <li>Anthropic (if you use AI-assisted question generation)</li>
            <li>Resend (for transactional emails such as magic links)</li>
            <li>Vercel (application hosting)</li>
          </ul>

          <h2 className="text-lg font-semibold">5. Cookies and Tracking</h2>
          <p>
            Quiztoad uses essential cookies for authentication session management. We do not use
            third-party tracking cookies or analytics services.
          </p>

          <h2 className="text-lg font-semibold">6. Your Rights</h2>
          <p>
            You may request deletion of your account and associated data at any time by contacting
            us. You can also export your trivia content before deleting your account.
          </p>

          <h2 className="text-lg font-semibold">7. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. If you delete your account,
            your personal information and content will be removed from our systems.
          </p>

          <h2 className="text-lg font-semibold">8. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. Continued use of the service after
            changes constitutes acceptance of the updated policy.
          </p>

          <div className="pt-4">
            <Link to="/login" className="text-sm text-muted-foreground hover:underline">
              &larr; Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

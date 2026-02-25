import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function TermsOfService() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Terms of Service</CardTitle>
          <p className="text-sm text-muted-foreground">Last updated: February 25, 2026</p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-4 text-sm">
          <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Quiztoad, you agree to be bound by these Terms of Service. If you
            do not agree to these terms, please do not use the service.
          </p>

          <h2 className="text-lg font-semibold">2. Description of Service</h2>
          <p>
            Quiztoad is a free trivia management application that allows users to create, edit, and
            present trivia rounds. The service includes AI-assisted question generation, question
            storage, and a presentation mode for live trivia events.
          </p>

          <h2 className="text-lg font-semibold">3. User Accounts</h2>
          <p>
            You may create an account using Google OAuth, email and password, or a magic link. You
            are responsible for maintaining the security of your account credentials. You must
            provide accurate information when creating your account.
          </p>

          <h2 className="text-lg font-semibold">4. User-Generated Content</h2>
          <p>
            You retain ownership of any trivia questions, rounds, or other content you create using
            Quiztoad. By using the service, you grant Quiztoad a license to store and display your
            content as necessary to provide the service. You are responsible for ensuring your
            content does not infringe on any third-party rights.
          </p>

          <h2 className="text-lg font-semibold">5. AI-Generated Content</h2>
          <p>
            Quiztoad may use AI (Claude by Anthropic) to generate trivia questions. AI-generated
            content is provided as-is and may contain inaccuracies. You are responsible for
            reviewing and editing AI-generated content before use.
          </p>

          <h2 className="text-lg font-semibold">6. Acceptable Use</h2>
          <p>
            You agree not to misuse the service, including but not limited to: interfering with the
            service's operation, attempting to access other users' accounts, or using the service
            for any unlawful purpose.
          </p>

          <h2 className="text-lg font-semibold">7. Service Availability</h2>
          <p>
            Quiztoad is provided free of charge and on an "as-is" basis. We do not guarantee
            uninterrupted availability and may modify or discontinue the service at any time without
            notice.
          </p>

          <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Quiztoad and its operators shall not be liable
            for any indirect, incidental, or consequential damages arising from your use of the
            service.
          </p>

          <h2 className="text-lg font-semibold">9. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the service after changes
            constitutes acceptance of the updated terms.
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

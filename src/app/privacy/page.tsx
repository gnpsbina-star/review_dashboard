import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/LegalPage";
import { supportEmail } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  const email = supportEmail();
  return (
    <LegalPage title="Privacy policy">
      <p>
        Smart Review Platform is run by <b>Synergy Technologies</b>. Businesses (our clients) use it to collect star ratings and feedback through QR codes, and to follow up on complaints. This page explains what we collect, why, and how long we keep it.
      </p>

      <h2>If you leave feedback through a QR code</h2>
      <ul>
        <li><b>What you give us:</b> your star rating, your comments, and optionally your name, phone number, email address and up to three photos.</li>
        <li><b>Why:</b> to pass your feedback to the business and, if you shared contact details, to let its manager contact you about it. The business decides how it uses your feedback; we process it on the business’s behalf.</li>
        <li><b>Photos:</b> re-encoded when uploaded, which removes location and other hidden data. Only people at that business who can see your feedback can view them.</li>
        <li><b>Security checks:</b> we keep a one-way scrambled code (a keyed hash) of your IP address and device to stop spam and repeat submissions. We cannot turn it back into your IP address.</li>
        <li><b>Reviews on Google or Facebook</b> are posted by you, on those sites, under their own privacy policies. We only count that you tapped the link.</li>
      </ul>

      <h2>If you sign in to the dashboard</h2>
      <ul>
        <li>
          We use <b>Sign in with Google</b> and ask Google only for your <b>name and email address</b> (the basic “openid, email, profile” permissions). We never see your Google password and do not access your Gmail, Drive, contacts or any other Google data.
        </li>
        <li>Your name and email are used only to sign you in, show who did what in your team’s dashboard, and send you alerts about your business.</li>
        <li>
          Our use of information received from Google APIs follows the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. We do not sell it, use it for advertising, or use it to train AI models.
        </li>
      </ul>

      <h2>Employee details</h2>
      <p>
        Businesses can add staff for ID cards and review QR codes: name, job title, employee code, photo, blood group and an emergency contact. The employer enters and controls these details. Photo enhancement runs inside the employer’s browser; staff photos are never sent to an AI service.
      </p>

      <h2>AI suggestions</h2>
      <p>
        Review suggestions are written by an AI service using only the business’s own settings (name, area, highlights and tone). Customer feedback, names, phone numbers and photos are never sent to an AI service.
      </p>

      <h2>Who else handles the data</h2>
      <p>We do not sell personal data. We use these service providers to run the platform, each only for its task:</p>
      <ul>
        <li>Vercel (hosting) and Neon (database), in Singapore</li>
        <li>Cloudflare (spam protection, photo storage and QR links)</li>
        <li>Google (sign-in and sending alert emails)</li>
        <li>An AI provider such as Google Gemini, for suggestion text only</li>
      </ul>
      <p>We may also disclose data when Indian law requires it.</p>

      <h2>How we protect it</h2>
      <p>
        All traffic is encrypted (HTTPS). Customer phone numbers, emails and staff emergency contacts are additionally encrypted in the database. Each business can only see its own data, and admin actions are logged.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Customer names, contact details and photos: deleted automatically <b>12 months</b> after the feedback.</li>
        <li>A business’s entire account: deleted <b>90 days</b> after its subscription ends and the account locks, unless renewed.</li>
        <li>Email delivery records: 90 days. Sign-in sessions: until they expire or you sign out.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Under India’s Digital Personal Data Protection Act, 2023, you can ask to see, correct or delete your personal data, withdraw consent, and raise a grievance. To do so, <ContactLine email={email} />. We reply within 30 days.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, we will update this page and the date at the top.</p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/LegalPage";
import { supportEmail } from "@/lib/env";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  const email = supportEmail();
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms cover the Smart Review Platform run by <b>Synergy Technologies</b>. By using the dashboard or leaving feedback through a QR code, you agree to them.
      </p>

      <h2>For customers</h2>
      <ul>
        <li>Leave honest feedback about your own experience. Don’t post anything unlawful, abusive or someone else’s personal details.</li>
        <li>AI suggestions are only a starting point. Edit them so the review says what you really think. You post reviews on Google or Facebook yourself, under those sites’ rules.</li>
      </ul>

      <h2>For businesses (clients)</h2>
      <ul>
        <li>Access is by yearly subscription. If it isn’t renewed, the account locks after a 7-day grace period and is deleted 90 days later.</li>
        <li>You are responsible for your team’s accounts, the details you enter (including employee data, collected with their consent), and how you use customer feedback and contact details.</li>
        <li>
          You must follow Google’s and Facebook’s review policies. In particular, don’t offer rewards for reviews, write reviews for customers, or discourage unhappy customers from posting publicly. The platform shows the public review links to every customer for this reason.
        </li>
        <li>Don’t try to access another business’s data, overload the service, or get around its security.</li>
      </ul>

      <h2>Service</h2>
      <p>
        We work to keep the platform available and secure but cannot promise it will be uninterrupted or error-free, or guarantee any number of reviews or ratings. To the extent the law allows, our total liability is limited to the subscription fees paid for the last 12 months.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle personal data is described in our <a href="/privacy">privacy policy</a>.
      </p>

      <h2>Law and contact</h2>
      <p>
        These terms are governed by the laws of India. For questions, <ContactLine email={email} />.
      </p>
    </LegalPage>
  );
}

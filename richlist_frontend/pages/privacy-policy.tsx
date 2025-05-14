import Head from 'next/head';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <Head>
        <title>Privacy Policy - The Internet Rich List</title>
        <meta 
          name="description" 
          content="Privacy policy for Rich List App, outlining how we use your information." 
        />
      </Head>
      <article className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="mb-4">Effective Date: April 11, 2025</p>
        <p className="mb-4">
          This Privacy Policy describes how The Internet Rich List (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and safeguards your personal information when you access or use our website (<a href="https://theinternetrichlist.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">https://theinternetrichlist.com/</a>).
        </p>
        <h2 className="text-2xl font-bold mt-6 mb-2">Information We Collect</h2>
        <p className="mb-4">
          When you participate in our leaderboard, we ask you to provide:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Your name or alias</li>
          <li>Your email address</li>
          <li>The amount (numeric value) of your contribution</li>
          <li>An optional link for self-promotion</li>
        </ul>
        <p className="mb-4">Please note:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Your email address is used solely to link your payment with your leaderboard entry.</li>
          <li>We do not store your email address on our servers. Instead, it is processed and stored by our payment processor, Stripe.</li>
          <li>The data we store on our servers includes your name, the amount, and your Stripe customer ID (which uniquely identifies you).</li>
        </ul>
        <h2 className="text-2xl font-bold mt-6 mb-2">How We Use Your Information</h2>
        <p className="mb-4">
          We primarily use your information to update your leaderboard entry and manage payment processing. Your email is only used for these purposes and is not shared with any other third parties except for our payment provider.
        </p>
        <h2 className="text-2xl font-bold mt-6 mb-2">Data Security</h2>
        <p className="mb-4">
          We apply industry-standard security measures to protect your information. However, please be aware that no method of transmission over the Internet or electronic storage is completely secure.
        </p>
        <h2 className="text-2xl font-bold mt-6 mb-2">Third-Party Services</h2>
        <p className="mb-4">
          We use Stripe for payment processing. Stripe&apos;s privacy practices govern your data as it relates to payments. We encourage you to review Stripe&apos;s privacy policy for more details.
        </p>
        <h2 className="text-2xl font-bold mt-6 mb-2">Your Rights</h2>
        <p className="mb-4">
          Under applicable data protection laws such as GDPR, you have the right to access, correct, or request deletion of your personal data. If you have any questions or requests regarding your information, please contact us at admin@theinternetrichlist.com.
        </p>
        <h2 className="text-2xl font-bold mt-6 mb-2">Changes to This Policy</h2>
        <p className="mb-4">
          We may update this Privacy Policy from time to time. Any changes will be posted on this page along with an updated effective date.
        </p>
        <h2 className="text-2xl font-bold mt-6 mb-2">Contact Us</h2>
        <p className="mb-4">
          If you have any questions or concerns about this Privacy Policy, please contact us at admin@theinternetrichlist.com.
        </p>
      </article>
    </main>
  );
}
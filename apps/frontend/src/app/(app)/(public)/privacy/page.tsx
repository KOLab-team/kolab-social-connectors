import { Metadata } from 'next';
import {
  LegalList,
  LegalPage,
  LegalSection,
  legalConfig,
} from '@gitroom/frontend/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy | KOLab Social Connectors',
  description:
    'How KOLab Social Connectors collects, uses, protects, and deletes account, publishing, and social messaging data.',
};

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="This policy explains how KOLab Social Connectors handles account information, connected social accounts, publishing data, and customer messages."
    >
      <LegalSection title="1. Scope and who we are">
        <p>
          KOLab Social Connectors is operated by {legalConfig.company} (“KOLab”,
          “we”, “us”, or “our”). It allows organizations to connect social-media
          accounts, publish content, and manage supported messages and public
          replies from one service.
        </p>
        <p>
          This policy supplements KOLab’s general website privacy policy and
          applies to the Social Connectors application, its APIs, OAuth
          connections, webhooks, and related support. We process personal data
          in accordance with the Personal Data (Privacy) Ordinance (Cap. 486) of
          Hong Kong (“PDPO”) and other laws that apply to a particular service
          relationship.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <LegalList>
          <li>
            <strong className="text-white">
              Account and organization data:
            </strong>{' '}
            name, email address, login credentials, organization name, team
            membership, role, preferences, and support communications.
          </li>
          <li>
            <strong className="text-white">Social connection data:</strong>{' '}
            provider and account identifiers, Page or professional-account
            names, usernames, profile images, granted permissions, OAuth access
            and refresh tokens, token expiry, and connection status.
          </li>
          <li>
            <strong className="text-white">Publishing data:</strong> drafts,
            captions, media references, schedules, settings, publishing results,
            public post identifiers, links, comments, and analytics requested by
            your organization.
          </li>
          <li>
            <strong className="text-white">Inbox data:</strong> messages sent to
            or from a connected Facebook Page or Instagram professional account,
            public Threads replies, sender identifiers, names, usernames,
            attachments, timestamps, delivery/read states, and internal team
            notes.
          </li>
          <li>
            <strong className="text-white">Technical data:</strong> IP address,
            browser and device information, request metadata, security events,
            application logs, queue and webhook status, and feature usage.
          </li>
          <li>
            <strong className="text-white">Billing data:</strong> subscription
            and transaction records where a paid service applies. Payment-card
            details are handled by the applicable payment provider rather than
            stored in full by KOLab.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Where information comes from">
        <p>
          We receive information from you and your organization, authorized
          teammates, connected platforms such as Meta, people who communicate
          with a connected business account, and our infrastructure and security
          providers. We receive social-platform data only after an authorized
          user connects an account or when a platform sends an event for that
          connected account.
        </p>
      </LegalSection>

      <LegalSection title="4. How we use information">
        <LegalList>
          <li>authenticate users and administer organizations and roles;</li>
          <li>connect, refresh, and disconnect social-media integrations;</li>
          <li>publish, schedule, synchronize, and report on social content;</li>
          <li>receive, display, send, and synchronize supported messages;</li>
          <li>
            prevent duplicate events and recover missed webhook deliveries;
          </li>
          <li>provide support and notify users of errors or expired access;</li>
          <li>secure, monitor, troubleshoot, and improve the service;</li>
          <li>
            comply with law and enforce our agreements and platform rules.
          </li>
        </LegalList>
        <p>
          We do not use the contents of connected business inboxes to build
          advertising profiles, and we do not sell personal data.
        </p>
      </LegalSection>

      <LegalSection title="5. Legal and operational grounds">
        <p>
          Depending on the context, we process information to perform our
          contract with your organization, follow your authorized instructions,
          comply with legal obligations, protect legitimate security and
          operational interests, or act with consent where consent is required.
          A client organization may act as the controller of the business
          communications it connects to KOLab, while KOLab processes that data
          to provide the contracted service.
        </p>
      </LegalSection>

      <LegalSection title="6. When information is shared">
        <LegalList>
          <li>
            with connected platforms when your organization asks us to
            authenticate, publish, retrieve data, or send a response;
          </li>
          <li>
            with authorized members of the organization that owns the connected
            account;
          </li>
          <li>
            with hosting, database, storage, email, monitoring, security, and
            payment vendors acting under appropriate obligations;
          </li>
          <li>
            with professional advisers, affiliates, or transaction parties when
            reasonably necessary and legally permitted;
          </li>
          <li>
            when required by law, legal process, or a valid governmental
            request, or to protect rights, safety, and service integrity.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="7. International processing">
        <p>
          KOLab and its service providers may process information in Hong Kong
          and other locations where our infrastructure or vendors operate. We
          take reasonable steps to protect transferred information and to apply
          contractual, access-control, and security measures appropriate to the
          processing.
        </p>
      </LegalSection>

      <LegalSection title="8. Retention and deletion">
        <p>
          We keep information for as long as an account or integration is active
          and as needed to provide the service, satisfy contractual or legal
          requirements, resolve disputes, prevent abuse, and maintain security
          records. Retention periods depend on the data and purpose.
        </p>
        <p>
          Disconnecting or deleting a social integration stops KOLab from using
          its stored credentials. A verified Meta deletion callback removes or
          anonymizes the matching credentials, platform identifiers, inbox data,
          and associated stored publishing data from active systems. Minimal
          confirmation and audit records may be retained to demonstrate that a
          request was completed. Isolated backup copies expire through the
          normal protected backup lifecycle and are not used for ordinary
          processing.
        </p>
        <p>
          See our{' '}
          <a className="text-[#f973ff] underline" href="/data-deletion">
            data deletion page
          </a>{' '}
          for self-service, Meta, and email request options.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We use HTTPS/TLS, access controls, tenant-scoped application queries,
          signed webhook verification, operational monitoring, restricted
          production access, and other technical and organizational safeguards.
          No internet service can guarantee absolute security. Users must
          protect their login credentials and promptly report suspected misuse.
        </p>
      </LegalSection>

      <LegalSection title="10. Cookies and analytics">
        <p>
          The application uses cookies and similar storage needed for login,
          security, organization selection, language, and application
          preferences. Where configured, analytics tools may measure service
          usage and reliability. Browser settings can restrict optional cookies,
          although blocking essential cookies may prevent login or application
          features from working.
        </p>
      </LegalSection>

      <LegalSection title="11. Your choices and rights">
        <p>
          Subject to applicable law, you may ask to access or correct personal
          data, withdraw consent where processing relies on consent, disconnect
          a social account, or request deletion. Organization administrators can
          also manage team access and connected accounts. We may need to verify
          identity and authority before acting on a request.
        </p>
        <p>
          PDPO access and correction requests may be sent to{' '}
          <a
            className="text-[#f973ff] underline"
            href={`mailto:${legalConfig.email}`}
          >
            {legalConfig.email}
          </a>
          . We will respond within the period required by applicable law,
          including the PDPO’s applicable response period.
        </p>
      </LegalSection>

      <LegalSection title="12. Children">
        <p>
          The service is intended for organizations and authorized business
          users and is not directed to children under 18. Contact us if you
          believe a child has provided account information to the service.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to this policy">
        <p>
          We may update this policy as the service, platform requirements, or
          law changes. We will post the revised policy with a new update date
          and provide additional notice when a material change requires it.
        </p>
      </LegalSection>

      <LegalSection title="14. Contact">
        <p>
          {legalConfig.company}
          <br />
          {legalConfig.jurisdiction}
          <br />
          Email:{' '}
          <a
            className="text-[#f973ff] underline"
            href={`mailto:${legalConfig.email}`}
          >
            {legalConfig.email}
          </a>
        </p>
        <p>
          You may also contact the Office of the Privacy Commissioner for
          Personal Data, Hong Kong, if you believe your rights under the PDPO
          have been infringed.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

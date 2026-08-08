import { Metadata } from 'next';
import {
  LegalList,
  LegalPage,
  LegalSection,
  legalConfig,
} from '@gitroom/frontend/components/legal/legal-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Data Deletion | KOLab Social Connectors',
  description:
    'Request deletion of data associated with KOLab Social Connectors and check a Meta deletion request.',
};

type DeletionStatus = {
  confirmationCode: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  requestedAt: string;
  completedAt?: string | null;
};

async function getStatus(code?: string) {
  if (!code) return undefined;
  const backend = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    ''
  ).replace(/\/$/, '');
  if (!backend) return null;

  try {
    const response = await fetch(
      `${backend}/meta/data-deletion/${encodeURIComponent(code)}`,
      { cache: 'no-store' }
    );
    if (!response.ok) return null;
    return (await response.json()) as DeletionStatus;
  } catch {
    return null;
  }
}

const statusLabels: Record<DeletionStatus['status'], string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Needs attention',
};

export default async function DataDeletion({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams?.code?.trim();
  const status = await getStatus(code);
  const publicBackend = (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/api`
  ).replace(/\/$/, '');

  return (
    <LegalPage
      title="Data Deletion"
      summary="Disconnect a social account, request deletion directly, or check the status of a deletion request sent through Meta."
    >
      {code ? (
        <LegalSection title="Deletion request status">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            {status ? (
              <div className="space-y-2">
                <p>
                  Status:{' '}
                  <strong className="text-white">
                    {statusLabels[status.status]}
                  </strong>
                </p>
                <p className="break-all text-sm text-white/55">
                  Confirmation code: {status.confirmationCode}
                </p>
                <p className="text-sm text-white/55">
                  Requested: {new Date(status.requestedAt).toUTCString()}
                </p>
                {status.completedAt ? (
                  <p className="text-sm text-white/55">
                    Completed: {new Date(status.completedAt).toUTCString()}
                  </p>
                ) : null}
                {status.status === 'FAILED' ? (
                  <p>
                    Contact{' '}
                    <a
                      className="text-[#f973ff] underline"
                      href={`mailto:${
                        legalConfig.email
                      }?subject=Data deletion ${encodeURIComponent(
                        status.confirmationCode
                      )}`}
                    >
                      {legalConfig.email}
                    </a>{' '}
                    with the confirmation code so we can complete the request.
                  </p>
                ) : null}
              </div>
            ) : (
              <p>
                We could not find that confirmation code. Check the exact code
                returned by Meta or contact{' '}
                <a
                  className="text-[#f973ff] underline"
                  href={`mailto:${legalConfig.email}`}
                >
                  {legalConfig.email}
                </a>
                .
              </p>
            )}
          </div>
        </LegalSection>
      ) : null}

      <LegalSection title="1. Disconnect inside KOLab">
        <p>
          An organization administrator can open the Integrations area, select
          the connected account, and remove it. This prevents future publishing,
          synchronization, and messaging through the stored credentials. If you
          need all associated historical data removed as well, use one of the
          deletion-request methods below.
        </p>
      </LegalSection>

      <LegalSection title="2. Delete through Facebook or Instagram">
        <p>
          You can remove the KOLab application through your Meta/Facebook app
          and website settings and select the option to delete information sent
          to KOLab. Meta then sends KOLab a signed request identifying the
          authorizing user.
        </p>
        <p>
          After validating Meta’s signature, KOLab generates a confirmation code
          and queues deletion for matching Facebook and Instagram integrations.
          The response includes a private status link on this page. The process
          removes or anonymizes OAuth credentials, platform identifiers,
          connected inbox data, and associated stored publishing data from
          active systems.
        </p>
      </LegalSection>

      <LegalSection title="3. Request deletion by email">
        <p>
          Email{' '}
          <a
            className="text-[#f973ff] underline"
            href={`mailto:${legalConfig.email}`}
          >
            {legalConfig.email}
          </a>{' '}
          with the subject “Social Connectors data deletion”. Include the KOLab
          organization name, your account email, and the connected social Page
          or username. Do not email access tokens, passwords, or App Secrets.
        </p>
        <p>
          We may ask you to verify your identity, organization membership, and
          authority over the connected account before deleting data. We will
          acknowledge and complete verified requests within the period required
          by applicable law and will ordinarily target completion within 30
          days.
        </p>
      </LegalSection>

      <LegalSection title="4. What deletion covers">
        <LegalList>
          <li>stored Meta access and refresh credentials;</li>
          <li>connected Page, account, profile, and authorizing-user IDs;</li>
          <li>Facebook and Instagram inbox contacts and message history;</li>
          <li>
            public Threads reply data when included in the verified request;
          </li>
          <li>stored publishing content and provider delivery references;</li>
          <li>
            webhook subscriptions and integration-specific automation data.
          </li>
        </LegalList>
        <p>
          We may keep a minimal, pseudonymous deletion record containing the
          confirmation code, request time, completion state, and a one-way
          subject hash. Published content already present on a social platform
          is controlled by that platform and may need to be removed there
          separately. Protected backup copies expire through the normal backup
          lifecycle and are not used for ordinary processing.
        </p>
      </LegalSection>

      <LegalSection title="5. Check a confirmation code">
        <form
          action="/data-deletion"
          method="get"
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            aria-label="Confirmation code"
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#f973ff]"
            name="code"
            placeholder="Enter confirmation code"
            required
            type="text"
          />
          <button
            className="rounded-lg bg-[#f973ff] px-5 py-3 font-semibold text-black hover:bg-[#ff9bff]"
            type="submit"
          >
            Check status
          </button>
        </form>
      </LegalSection>

      <LegalSection title="6. Meta technical callback">
        <p>
          Meta App Dashboard reviewers and administrators can configure the
          following HTTPS Data Deletion Request Callback URL:
        </p>
        <code className="block overflow-x-auto rounded-lg border border-white/10 bg-black/35 p-4 text-sm text-white/80">
          {publicBackend}/meta/data-deletion
        </code>
        <p>
          The endpoint accepts Meta’s `signed_request` POST field, verifies its
          HMAC-SHA256 signature using the server-side app secret, and returns a
          JSON object containing `url` and `confirmation_code`.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
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
      </LegalSection>
    </LegalPage>
  );
}

import Link from 'next/link';
import { ReactNode } from 'react';

export const legalConfig = {
  company: process.env.LEGAL_ENTITY_NAME || 'KOLab Inc.',
  email: process.env.PRIVACY_EMAIL || 'contact@kolab-inc.com',
  jurisdiction: process.env.LEGAL_JURISDICTION || 'Hong Kong',
};

export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <header className="border-b border-white/10 bg-[#141414]">
        <div className="mx-auto flex max-w-[980px] items-center justify-between px-6 py-5">
          <Link href="/auth/login" className="text-lg font-semibold">
            KOLab Social Connectors
          </Link>
          <nav className="flex gap-4 text-sm text-white/70">
            <Link className="hover:text-white" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-white" href="/terms">
              Terms
            </Link>
            <Link className="hover:text-white" href="/data-deletion">
              Data deletion
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-6 py-14">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-[#f973ff]">
          Legal
        </p>
        <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-[720px] text-lg leading-8 text-white/65">
          {summary}
        </p>
        <p className="mt-4 text-sm text-white/45">
          Last updated: 8 August 2026
        </p>

        <article className="mt-12 space-y-10 text-[15px] leading-7 text-white/75">
          {children}
        </article>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-[980px] flex-col gap-2 px-6 py-8 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 {legalConfig.company}. All rights reserved.</span>
          <a className="hover:text-white" href={`mailto:${legalConfig.email}`}>
            {legalConfig.email}
          </a>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-2xl font-semibold text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}

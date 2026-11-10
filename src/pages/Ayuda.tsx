import { ExternalLink, HeartHandshake } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

const official = 'https://www.miagao.gov.ph';

function SourceLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-blue-800 underline decoration-blue-300 underline-offset-4 hover:text-blue-950"
    >
      {children} <ExternalLink size={14} />
    </a>
  );
}

function Program({
  id,
  tag,
  title,
  children,
}: {
  id: string;
  tag: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
        {tag}
      </p>
      <h2 className="mt-2 text-2xl font-bold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3 leading-7 text-slate-700">{children}</div>
    </section>
  );
}

export default function Ayuda() {
  return (
    <main className="flex-1">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">
            <HeartHandshake size={17} /> Public assistance records
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Ayuda programs
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-200">
            Published program costs and reported assistance distributions for
            Miagao. Each entry identifies whether it is a disclosure figure or a
            reported recipient payout; those figures are not interchangeable.
          </p>
          <p className="mt-4 text-sm text-slate-300">
            Sources: Miagao 2026 Full Disclosure and official municipal news.
            Figures reflect the cited record and reporting period.
          </p>
        </div>
      </section>

      <nav
        aria-label="Ayuda program sections"
        className="border-b border-slate-200 bg-white"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap gap-x-5 gap-y-2 px-4 py-4 text-sm font-semibold sm:px-6 lg:px-8">
          {[
            ['AICS', '#aics'],
            ['PAFF', '#paff'],
            ['TUPAD', '#tupad'],
            ['Senior citizens', '#senior-citizens'],
            ['Other programs', '#other-programs'],
          ].map(([label, href]) => (
            <a key={href} href={href} className="text-blue-800 hover:underline">
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <Program
          id="aics"
          tag="Municipal program · Q3 2026 disclosure"
          title="Assistance to Individuals in Crisis Situation"
        >
          <p>
            The Q3 consolidated program report lists <strong>₱2,704,000</strong>{' '}
            total cost and <strong>₱2,300,000</strong> incurred to date, with
            85.05% completion. The row is marked as a continuing program and
            covers January–December 2026.
          </p>
          <p className="text-sm text-slate-600">
            These are program progress and cost figures, not a beneficiary
            roster or a count of individual aid releases.
          </p>
          <SourceLink
            href={`${official}/wp-content/uploads/2026/10/consolidated-report-3rd-qtr-2026-1.xlsx`}
          >
            Q3 consolidated report · MSWDO worksheet, rows 10–11
          </SourceLink>
        </Program>

        <Program
          id="paff"
          tag="Reported distribution · November 2026"
          title="Presidential Assistance for Farmers and Fisherfolk"
        >
          <p>
            The municipal report says <strong>205 fisherfolk</strong> received{' '}
            <strong>₱2,325 each</strong> on November 6, 2026. The implied batch
            total is <strong>₱476,625</strong> (recipients multiplied by the
            stated per-person amount).
          </p>
          <p className="text-sm text-slate-600">
            The news post records a distribution; it does not state a Miagao
            budget appropriation or identify the funding split.
          </p>
          <SourceLink
            href={`${official}/about-miagao/news/%F0%9D%97%A0%F0%9D%97%94%F0%9D%97%AC%F0%9D%97%A2%F0%9D%97%A5-%F0%9D%97%9A%F0%9D%97%94%F0%9D%97%A5%F0%9D%97%9C%F0%9D%97%A1-%F0%9D%97%9F%F0%9D%97%98%F0%9D%97%94%F0%9D%97%97%F0%9D%97%A6-%F0%9D%97%A3/`}
          >
            Official PAFF distribution report
          </SourceLink>
        </Program>

        <Program
          id="tupad"
          tag="Reported distribution · July 2026"
          title="TUPAD"
        >
          <p>
            The municipal report says <strong>159 beneficiaries</strong>{' '}
            received <strong>₱5,500 each</strong> for 10 days of work on July 3,
            2026. The implied batch total is <strong>₱874,500</strong>.
          </p>
          <p className="text-sm text-slate-600">
            This is a reported wage distribution for one cohort, not a full-year
            TUPAD allocation. Another municipal report mentions 320 workers but
            does not state a wage amount.
          </p>
          <SourceLink
            href={`${official}/about-miagao/news/dole-tupad-beneficiaries-receive-p5500-wages/`}
          >
            Official TUPAD distribution report
          </SourceLink>
        </Program>

        <Program
          id="senior-citizens"
          tag="Trust-fund utilization · Q3 2026"
          title="Senior citizen social pension"
        >
          <p>
            The Q3 trust-fund utilization report lists “DSWD Senior Citizen” at
            <strong> ₱34,494,000</strong> total cost and{' '}
            <strong>₱17,355,000</strong> incurred to date (50.31% completion).
          </p>
          <p className="text-sm text-slate-600">
            This is a trust-fund project line. It should not be read as a
            verified count of pension recipients or as a separate total from
            cash-advance entries in other quarterly files.
          </p>
          <SourceLink
            href={`${official}/wp-content/uploads/2026/10/Trust-Fund-Utilization-as-of-September-30-2026-F.xlsx`}
          >
            Q3 trust-fund utilization source
          </SourceLink>
        </Program>

        <Program
          id="other-programs"
          tag="Coverage note"
          title="Programs still to identify"
        >
          <p>
            Pantawid Pamilya appears in the Q3 MSWDO schedule as a{' '}
            <strong>₱90,000</strong> program line, with ₱36,000 incurred to
            date. This is not the value of household cash transfers.
          </p>
          <SourceLink href={`${official}/transparency/2026-full-disclosure/`}>
            2026 Full Disclosure index
          </SourceLink>
        </Program>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <Link
          to="/transparency"
          className="font-semibold text-blue-800 underline"
        >
          Browse all budget and procurement records
        </Link>
      </div>
    </main>
  );
}

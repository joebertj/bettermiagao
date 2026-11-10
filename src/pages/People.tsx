import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import officials from '../data/miagao-officials.json';

function SourceLink({
  href,
  children = 'Source',
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-blue-800 underline decoration-blue-300 underline-offset-2 hover:text-blue-950"
    >
      {children}
      <ExternalLink size={13} />
    </a>
  );
}

export default function People() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-800">
          Miagao · People and offices
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Who holds public office?
        </h1>
        <p className="mt-4 text-lg leading-8 text-gray-700">
          A sourced starting point for Miagao’s municipal leadership, Iloilo’s
          1st District representation, and the DPWH office tied to project
          records.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Names and roles are attributed to the cited records. Parsed document
          signatures are candidates only: they do not establish current
          appointment, personal responsibility, project sponsorship, or
          approval.
        </p>
      </header>

      <section className="mb-12 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl bg-slate-950 p-6 text-white">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-200">
            Municipal mayors · sourced timeline
          </p>
          <div className="mt-6 space-y-6">
            {officials.mayors.map(mayor => (
              <article
                key={mayor.name}
                className="relative border-l-2 border-blue-400 pl-5"
              >
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-amber-400" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {mayor.period}
                </p>
                <h2 className="mt-1 text-xl font-bold">{mayor.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {mayor.basis}
                </p>
                <div className="mt-2">
                  <SourceLink href={mayor.source}>Municipal record</SourceLink>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-6 text-xs leading-5 text-slate-400">
            The municipal profile says Miagao has had 135 town heads since 1716.
            This timeline is a documented recent slice, not the full historical
            roster.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-blue-800">
                Current municipal officials
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Elected leadership
              </h2>
            </div>
            <SourceLink href={officials.sources.municipalOfficials}>
              Official Miagao roster
            </SourceLink>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {officials.currentOfficials.map(person => (
              <article
                key={`${person.role}-${person.name}`}
                className="flex items-center gap-4 rounded-xl border border-gray-200 p-4"
              >
                <img
                  src={person.photo}
                  alt={person.name}
                  loading="lazy"
                  className="h-20 w-20 shrink-0 rounded-lg object-cover object-top"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    {person.role}
                  </p>
                  <p className="mt-1 font-semibold text-gray-950">
                    {person.name}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Portraits and roster from the Municipality of Miagao public listing;
            roster checked {officials.asOf}.
          </p>
        </div>
      </section>

      <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-800">
          Council history
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">
          Documented Sangguniang Bayan members
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          The archived municipal record below names the council members who took
          office for the 2010–2013 term. Historical coverage is being added term
          by term as named official records are located.
        </p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {officials.historicalCouncilTerms.map(term => (
            <article key={term.period} className="rounded-xl bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-gray-950">{term.period}</h3>
                <SourceLink href={term.source}>Municipal record</SourceLink>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                {term.basis}
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {term.members.map(name => (
                  <li
                    key={name}
                    className="rounded bg-white px-3 py-2 text-sm text-gray-800"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-800">
              Iloilo · 1st District
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              District representatives
            </h2>
          </div>
          <SourceLink href={officials.sources.districtRepresentative}>
            Current House profile
          </SourceLink>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          Miagao is part of Iloilo’s 1st Congressional District. Earlier entries
          use the cited historical roster references in BetterGov data; the
          current entry is checked against the House of Representatives
          directory.
        </p>
        <div className="mt-5 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-3">Congress / term</th>
                <th className="px-4 py-3">District representative</th>
                <th className="px-4 py-3">Roster source</th>
              </tr>
            </thead>
            <tbody>
              {officials.districtRepresentatives.map(row => (
                <tr
                  key={row.period}
                  className="border-t border-gray-200 odd:bg-white even:bg-slate-50"
                >
                  <td className="px-4 py-3">{row.period}</td>
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">
                    <SourceLink href={row.source}>Open roster</SourceLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12 grid gap-8 lg:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-800">
            DPWH · Iloilo 1st District Engineering Office
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Project office and parsed signatories
          </h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            The office name appears on DPWH procurement records for projects in
            Miagao and surrounding municipalities. The names below were
            extracted from Senate-provided project documents whose titles
            mention Miagao.
          </p>
          <div className="mt-5 space-y-3">
            {officials.parsedProjectDocumentCandidates.map(person => (
              <div
                key={person.name}
                className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-gray-950">{person.name}</p>
                  <p className="text-sm text-gray-600">{person.role}</p>
                </div>
                <span className="whitespace-nowrap text-right text-sm text-gray-600">
                  {person.miagaoProjectTitles} document titles
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <SourceLink href={officials.sources.districtOffice}>
              DPWH procurement record
            </SourceLink>
            <SourceLink href={officials.sources.parsedDocumentData}>
              Parsed-document data
            </SourceLink>
          </div>
          <p className="mt-4 text-xs leading-5 text-gray-500">
            Document-extracted role candidates are not a verified current staff
            list. A signature or parsed role does not establish that an
            individual sponsored or approved a project.
          </p>
        </article>

        <article className="rounded-2xl bg-amber-50 p-6">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-900">
            How to read this page
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Records have different strengths
          </h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-gray-700">
            <li>
              Current elected-official information comes from the Municipality
              of Miagao’s published roster.
            </li>
            <li>
              Congressional roster history for the 16th–19th Congress is based
              on cited historical roster data; the 20th Congress listing is
              checked against the House directory.
            </li>
            <li>
              Engineer names come from automated text extraction of project
              documents. OCR and parsing can misread names and role labels.
            </li>
            <li>
              “Project title mentions Miagao” is not a complete geographic
              boundary check. Some roads or river works may cross municipal
              boundaries.
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <SourceLink href={officials.sources.municipalOfficials}>
              Municipal roster
            </SourceLink>
            <SourceLink href={officials.sources.municipalHistory}>
              Municipal history
            </SourceLink>
            <SourceLink href={officials.sources.historicalCongressSources}>
              BetterGov historical roster references
            </SourceLink>
          </div>
        </article>
      </section>
    </main>
  );
}

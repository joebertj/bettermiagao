import { ExternalLink } from 'lucide-react';

export default function About() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-800">
        About Better Miagao
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Public records, made easier to follow
      </h1>
      <p className="mt-5 text-lg leading-8 text-gray-700">
        Better Miagao is an independent civic information project. It organizes
        public records about Miagao, Iloilo, and links back to the sources so
        readers can check the underlying material.
      </p>
      <div className="mt-8 space-y-5 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold">Project and budget records</h2>
        <p className="leading-7 text-gray-700">
          The current projects dataset is based on BetterGov DPWH project data.
          The initial Miagao view selects rows whose titles contain “Miagao” or
          “Miag-ao.” This method can miss projects described only by barangay
          and can include long corridors whose full location needs review.
        </p>
        <p className="leading-7 text-gray-700">
          FY2027 rows are from a House 3rd-reading bill extract. A proposal is
          not an enacted appropriation. Budget amounts do not establish
          releases, expenditure, construction, quality, or completion.
        </p>
        <p className="leading-7 text-gray-700">
          Historical rows are shown by fiscal year and their source reference.
          Similar titles are not automatically treated as the same physical
          project.
        </p>
        <h2 className="pt-2 text-xl font-bold">Sources used on Barangays</h2>
        <p className="leading-7 text-gray-700">
          The barangay dashboard combines local records published by the
          Municipality of Miagao with population and boundary references and
          BetterGov national project records. The links below point to the
          source material used for the displayed tables and charts.
        </p>
        <ul className="list-disc space-y-2 pl-5 leading-7 text-gray-700">
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://psa.gov.ph/classification/psgc/barangays/0603030000"
              target="_blank"
              rel="noreferrer"
            >
              Philippine Statistics Authority · PSGC and 2024 population
              reference
            </a>
          </li>
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://archive.org/download/20250914.dilg.barangay/official-list_06_2025-09-14.xlsx"
              target="_blank"
              rel="noreferrer"
            >
              DILG Barangay Information System · Region VI roster snapshot, 14
              September 2025
            </a>{' '}
            — a dated roster for the 2023–2025 term, not a live current-office
            register.
          </li>
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://www.miagao.gov.ph/wp-content/uploads/2026/10/20NTAutilizationnewformat2026.xlsx"
              target="_blank"
              rel="noreferrer"
            >
              Municipality of Miagao · 2026 Q3 20% NTA utilization schedule
            </a>
          </li>
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://www.miagao.gov.ph/wp-content/uploads/2026/06/CONSOLIDATED-APP-2026.xlsx"
              target="_blank"
              rel="noreferrer"
            >
              Municipality of Miagao · 2026 Annual Procurement Plan
            </a>
          </li>
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://www.miagao.gov.ph/wp-content/uploads/2026/05/FDP-DILG-Compliance-1st-Quarter-2026-CivilGoods-and-Consulting-Services.xlsx"
              target="_blank"
              rel="noreferrer"
            >
              Municipality of Miagao · 2026 Q1 civil-works bid results
            </a>{' '}
            and{' '}
            <a
              className="font-semibold text-blue-800 underline"
              href="https://www.miagao.gov.ph/wp-content/uploads/2026/10/FDP-DILG-Compliance-3rd-Quarter-2026-CivilGoods-and-Consulting-Services.xlsx"
              target="_blank"
              rel="noreferrer"
            >
              2026 Q3 civil-works bid results
            </a>
          </li>
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://research.bettergov.ph/static/nep-preview/integrated-project-data.json"
              target="_blank"
              rel="noreferrer"
            >
              BetterGov · DPWH historical and FY2027 project data
            </a>{' '}
            — barangay links are based on project title or source location
            fields; shared projects can appear under multiple barangays.
          </li>
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://lgu.bettergov.ph"
              target="_blank"
              rel="noreferrer"
            >
              BetterGov LGU platform
            </a>{' '}
            — local-government information and services.
          </li>
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://budget.bettergov.ph"
              target="_blank"
              rel="noreferrer"
            >
              BetterGov Budget platform
            </a>{' '}
            — budget data and analysis.
          </li>
          <li>
            Barangay boundary shapes:{' '}
            <a
              className="font-semibold text-blue-800 underline"
              href="https://github.com/faeldon/philippines-json-maps"
              target="_blank"
              rel="noreferrer"
            >
              PSGC 3Q 2026 boundary dataset
            </a>
            , based on NAMRIA and PSA data through OCHA COD-AB (CC BY-IGO).
          </li>
        </ul>
        <h2 className="pt-2 text-xl font-bold">People and roles</h2>
        <p className="leading-7 text-gray-700">
          Elected-office rosters are linked to official records where available.
          Historical House roster references and extracted signatory names are
          labeled with their sources and limitations. Automated extraction can
          misread scans and does not verify current office or individual
          responsibility.
        </p>
        <h2 className="pt-2 text-xl font-bold">Independence</h2>
        <p className="leading-7 text-gray-700">
          This site is not the Municipality of Miagao’s official website and
          does not speak for the municipal government or any public office.
        </p>
        <a
          className="inline-flex items-center gap-1 font-semibold text-blue-800 underline"
          href="https://www.miagao.gov.ph/"
          target="_blank"
          rel="noreferrer"
        >
          Visit the official Municipality of Miagao website{' '}
          <ExternalLink size={14} />
        </a>
        <h2 className="pt-2 text-xl font-bold">Related BetterGov projects</h2>
        <p className="leading-7 text-gray-700">
          Explore the related public data and research sites:
        </p>
        <ul className="list-disc space-y-2 pl-5 leading-7 text-gray-700">
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://visualizations.bettergov.ph/sources"
            >
              BetterGov visualizations · data sources
            </a>
          </li>
          <li>
            <a
              className="font-semibold text-blue-800 underline"
              href="https://research.bettergov.ph/"
            >
              BetterGov research · budget and project analysis
            </a>
          </li>
        </ul>
      </div>
    </main>
  );
}

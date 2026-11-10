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
      </div>
    </main>
  );
}

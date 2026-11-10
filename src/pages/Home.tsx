import {
  ArrowRight,
  Building2,
  FileSearch,
  Landmark,
  MapPinned,
} from 'lucide-react';
import { Link } from 'react-router';
import records from '../data/miagao-projects.json';

const proposed = records.projects.filter(project => project.year === 2027);
const recent = records.projects.filter(
  project => project.year >= 2017 && project.year <= 2025
);
const proposedAmount = proposed.reduce(
  (sum, project) => sum + project.amountPesos,
  0
);
const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export default function Home() {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <img
            src="/images/miagao-church.jpg"
            alt=""
            className="h-full w-full object-cover object-center opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-blue-950/60" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_0.8fr] md:items-center md:py-24 lg:px-8">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-200">
              <MapPinned size={14} /> Miagao · Iloilo
            </p>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              A clearer view of public decisions in Miagao.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Explore public project records, the officials and offices
              connected to them, and the sources behind each entry.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/projects"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300"
              >
                Explore projects <ArrowRight size={17} />
              </Link>
              <Link
                to="/people"
                className="inline-flex min-h-12 items-center rounded-lg border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10"
              >
                People & offices
              </Link>
            </div>
            <p className="mt-6 max-w-2xl text-xs leading-5 text-slate-400">
              An independent civic information project. It is not the official
              website of the Municipality of Miagao and does not claim that a
              listed budget was spent or completed.
            </p>
            <p className="mt-5 text-xs text-slate-300">
              Photo:{' '}
              <a
                href="https://commons.wikimedia.org/wiki/File:Miag-ao_Church_UNESCO.jpg"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate-400 underline-offset-2 hover:text-white"
              >
                Ryan Sia / Wikimedia Commons
              </a>{' '}
              ·{' '}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate-400 underline-offset-2 hover:text-white"
              >
                CC BY-SA 4.0
              </a>{' '}
              · cropped for this hero
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <FileSearch className="mb-4 text-amber-300" />
              <strong className="block text-3xl">{recent.length}</strong>
              <span className="mt-1 block text-sm text-slate-300">
                GAA project rows · 2017–2025
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <Landmark className="mb-4 text-amber-300" />
              <strong className="block text-3xl">{proposed.length}</strong>
              <span className="mt-1 block text-sm text-slate-300">
                FY2027 House proposal rows
              </span>
            </div>
            <div className="col-span-2 rounded-2xl bg-blue-700 p-5">
              <p className="text-sm font-medium text-blue-100">
                FY2027 proposal amount in the title-matched rows
              </p>
              <strong className="mt-1 block text-3xl">
                {peso.format(proposedAmount)}
              </strong>
              <p className="mt-2 text-xs leading-5 text-blue-100">
                House 3rd-reading extract · proposed allocation, not an enacted
                budget.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-7 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-800">
            Start here
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Follow the public record
          </h2>
          <p className="mt-3 text-gray-600">
            Records are grouped by what they show, with clear notes about gaps
            and uncertainty.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Link
            to="/projects"
            className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <Building2 className="mb-6 text-blue-800" size={30} />
            <h3 className="text-xl font-bold text-gray-950">
              Projects & budgets
            </h3>
            <p className="mt-2 leading-6 text-gray-600">
              Search historical DPWH GAA rows and FY2027 proposal lines whose
              titles mention Miagao.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 font-bold text-blue-800">
              View project records <ArrowRight size={16} />
            </span>
          </Link>
          <Link
            to="/people"
            className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <Landmark className="mb-6 text-blue-800" size={30} />
            <h3 className="text-xl font-bold text-gray-950">
              People & offices
            </h3>
            <p className="mt-2 leading-6 text-gray-600">
              See municipal leadership, district representation, DPWH office
              context, and extracted document signatories.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 font-bold text-blue-800">
              See officials and offices <ArrowRight size={16} />
            </span>
          </Link>
          <Link
            to="/about"
            className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <FileSearch className="mb-6 text-blue-800" size={30} />
            <h3 className="text-xl font-bold text-gray-950">
              Sources & methods
            </h3>
            <p className="mt-2 leading-6 text-gray-600">
              Learn how records are matched and what the project can and cannot
              establish.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 font-bold text-blue-800">
              Read the notes <ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}

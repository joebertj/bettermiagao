import {
  ArrowRight,
  Building2,
  FileSearch,
  Landmark,
  MapPinned,
  Map,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router';
import { mainNavigation } from '../data/navigation';

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
              Miagao’s local records, made easier to explore.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Browse municipal budgets and procurement, barangay profiles, local
              projects, and the people and offices connected to them.
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
              <Map className="mb-4 text-amber-300" />
              <strong className="block text-3xl">119</strong>
              <span className="mt-1 block text-sm text-slate-300">
                barangays in Miagao
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <FileSearch className="mb-4 text-amber-300" />
              <strong className="block text-3xl">3,578</strong>
              <span className="mt-1 block text-sm text-slate-300">
                rows in the 2026 municipal APP
              </span>
            </div>
            <div className="col-span-2 rounded-2xl bg-blue-700 p-5">
              <p className="text-sm font-medium text-blue-100">
                2026 municipal appropriations recorded
              </p>
              <strong className="mt-1 block text-3xl">₱356.06 million</strong>
              <p className="mt-2 text-xs leading-5 text-blue-100">
                Office and account-level totals; the source does not assign an
                amount to every project title.
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mainNavigation.map(item => {
            const card = {
              '/projects': {
                icon: Building2,
                title: 'National',
                description:
                  'Review national DPWH GAA history and FY2027 House proposal lines that mention Miagao.',
                action: 'View national projects',
              },
              '/people': {
                icon: Landmark,
                title: 'People & offices',
                description:
                  'See municipal leadership, district representation, DPWH office context, and extracted document signatories.',
                action: 'See officials and offices',
              },
              '/barangays': {
                icon: Map,
                title: 'Barangays',
                description:
                  'Browse barangay profiles, mapped boundaries, local records, and linked projects.',
                action: 'Browse barangays',
              },
              '/transparency': {
                icon: Wallet,
                title: 'Budget & procurement',
                description:
                  'Explore available budget, procurement, bidding, and expenditure records.',
                action: 'View transparency records',
              },
              '/about': {
                icon: FileSearch,
                title: 'Sources & methods',
                description:
                  'Learn how records are matched and what the project can and cannot establish.',
                action: 'Read the notes',
              },
            }[item.href];
            if (!card) return null;
            const Icon = card.icon;
            return (
              <article
                key={item.href}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <Link to={item.href} className="group block">
                  <Icon className="mb-6 text-blue-800" size={30} />
                  <h3 className="text-xl font-bold text-gray-950">
                    {card.title}
                  </h3>
                  <p className="mt-2 leading-6 text-gray-600">
                    {card.description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 font-bold text-blue-800">
                    {card.action} <ArrowRight size={16} />
                  </span>
                </Link>
                {item.children?.length ? (
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                    {item.children.map(child => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-blue-800"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

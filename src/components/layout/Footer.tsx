import { Link } from 'react-router';
import { mainNavigation } from '../../data/navigation';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <p className="font-bold">Better Miagao</p>
          <p className="mt-1 max-w-2xl text-slate-300">
            Independent public-records project about Miagao, Iloilo. Not an
            official municipal government website.
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-5 gap-y-2"
        >
          {mainNavigation.map(link => (
            <div key={link.href} className="flex flex-col items-start gap-1">
              <Link
                className="text-slate-200 underline hover:text-white"
                to={link.href}
              >
                {link.label}
              </Link>
              {link.children?.map(child => (
                <Link
                  key={child.href}
                  className="pl-2 text-xs text-slate-300 underline decoration-slate-500 underline-offset-2 hover:text-white"
                  to={child.href}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          ))}
          <a
            className="text-slate-200 underline hover:text-white"
            href="https://www.miagao.gov.ph/"
            target="_blank"
            rel="noreferrer"
          >
            Official Miagao site
          </a>
        </nav>
      </div>
    </footer>
  );
}

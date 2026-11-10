import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { Menu, X } from 'lucide-react';
import { mainNavigation } from '../../data/navigation';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <Link to="/" className="flex flex-col items-start gap-1 leading-tight">
          <img
            src="/images/better-miagao-logo.png"
            alt="Better Miagao.org"
            className="h-9 w-auto sm:h-10"
          />
          <span className="text-[10px] text-gray-600 sm:text-xs">
            Independent civic information project
          </span>
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {mainNavigation.map(link => (
            <NavLink
              key={link.href}
              to={link.href}
              className={({ isActive }) =>
                `text-sm font-semibold ${isActive ? 'text-blue-800' : 'text-gray-700 hover:text-blue-800'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>
      {open && (
        <div className="space-y-1 border-t border-gray-200 bg-white px-4 py-3 md:hidden">
          {mainNavigation.map(link => (
            <NavLink
              key={link.href}
              to={link.href}
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}

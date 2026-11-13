import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ChevronDown, Menu, X } from 'lucide-react';
import { mainNavigation } from '../../data/navigation';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const budgetMenu = useRef<HTMLDetailsElement>(null);
  const location = useLocation();

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      const menu = budgetMenu.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && budgetMenu.current?.open) {
        budgetMenu.current.open = false;
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (budgetMenu.current) budgetMenu.current.open = false;
  }, [location.pathname]);

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
          {mainNavigation.map(link =>
            link.children ? (
              <details
                key={link.href}
                ref={link.href === '/transparency' ? budgetMenu : undefined}
                className="group relative"
              >
                <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-gray-700 hover:text-blue-800">
                  {link.label} <ChevronDown size={14} />
                </summary>
                <div className="absolute left-0 top-full z-50 mt-2 min-w-48 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                  <NavLink
                    to={link.href}
                    className="block rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-slate-50"
                  >
                    National projects
                  </NavLink>
                  {link.children.map(child => (
                    <NavLink
                      key={child.href}
                      to={child.href}
                      className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-slate-50 hover:text-blue-800"
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              </details>
            ) : (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  `text-sm font-semibold ${isActive ? 'text-blue-800' : 'text-gray-700 hover:text-blue-800'}`
                }
              >
                {link.label}
              </NavLink>
            )
          )}
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
            <div key={link.href}>
              <NavLink
                to={link.href}
                onClick={() => setOpen(false)}
                className="block rounded px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                {link.label}
              </NavLink>
              {link.children?.map(child => (
                <NavLink
                  key={child.href}
                  to={child.href}
                  onClick={() => setOpen(false)}
                  className="block rounded py-2 pl-7 text-sm text-gray-600 hover:bg-gray-100 hover:text-blue-800"
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

import type { NavigationItem } from '../types';

export const mainNavigation: NavigationItem[] = [
  { label: 'In a Glance', href: '/glance' },
  {
    label: 'Budget & procurement',
    href: '/transparency',
    children: [
      { label: 'Annual Procurement Plan (APP)', href: '/app' },
      { label: 'Ayuda', href: '/ayuda' },
    ],
  },
  { label: 'People & offices', href: '/people' },
  { label: 'Barangays', href: '/barangays' },
  {
    label: 'National',
    href: '/projects',
    children: [{ label: 'FY2027 budget comparison', href: '/budget' }],
  },
  { label: 'About', href: '/about' },
];

export const footerNavigation = {
  mainSections: [
    {
      title: 'About',
      links: [
        { label: 'About this project', href: '/about' },
        // { label: 'Privacy Policy', href: '/privacy' },
        // { label: 'Terms of Use', href: '/terms' },
        { label: 'Accessibility', href: '/accessibility' },
        { label: 'Contact Us', href: '/about' },
        {
          label: 'Official Miagao website',
          href: 'https://www.miagao.gov.ph/',
        },
      ],
    },
    {
      title: 'Explore',
      links: mainNavigation,
    },
    {
      title: 'Official sources',
      links: [
        { label: 'Municipality of Miagao', href: 'https://www.miagao.gov.ph/' },
        {
          label: 'Miagao elected officials',
          href: 'https://www.miagao.gov.ph/the-lgu/elected-officials/',
        },
        {
          label: 'House of Representatives',
          href: 'https://www.congress.gov.ph/house-members/view/E032',
        },
      ],
    },
  ],
  socialLinks: [
    { label: 'Facebook', href: 'https://facebook.com/govph' },
    { label: 'Twitter', href: 'https://twitter.com/govph' },
    { label: 'Instagram', href: 'https://instagram.com/govph' },
    { label: 'YouTube', href: 'https://youtube.com/govph' },
  ],
};

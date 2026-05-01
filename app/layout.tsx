import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import './globals.css';

const openSans = Open_Sans({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Portman Bipartisanship Scores',
  description:
    "Public-facing site for exploring the Portman Center's bipartisanship scores by legislator, chamber, party, and issue area.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${openSans.className} flex flex-col bg-gray-50 text-gray-900`}
        style={{ minHeight: 'max(100vh, 1000px)' }}
      >
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}

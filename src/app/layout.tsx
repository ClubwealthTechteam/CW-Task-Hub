import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CW AI Task Hub',
  description: 'Club Wealth AI Task Hub: department automations and integrations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

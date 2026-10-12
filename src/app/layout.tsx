import type { Metadata } from 'next';
import './globals.css';
import { getCurrentUser } from '@/lib/auth/current-user';
import { ChatWidget } from '@/components/chat/ChatWidget';

export const metadata: Metadata = {
  title: 'CW AI Task Hub',
  description: 'Club Wealth AI Task Hub: department automations and integrations.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&display=swap" />
      </head>
      <body>
        {children}
        {user && <ChatWidget firstName={user.name.split(/\s+/)[0]} />}
      </body>
    </html>
  );
}

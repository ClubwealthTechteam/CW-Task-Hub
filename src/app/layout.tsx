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
      <body>
        {children}
        {user && <ChatWidget firstName={user.name.split(/\s+/)[0]} />}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { getViewer } from '@/lib/auth/current-user';
import { ChatWidget } from '@/components/chat/ChatWidget';

export const metadata: Metadata = {
  title: 'CW AI Task Hub',
  description: 'Club Wealth AI Task Hub: department automations and integrations.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const user = viewer?.user;
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&display=swap" />
      </head>
      <body>
        {viewer?.preview && (
          <div className="preview-bar" role="status">
            <span>Previewing as <b>{viewer.user.name}</b> · read-only, chats are hidden</span>
            <a href="/api/preview?exit=1">Exit preview</a>
          </div>
        )}
        {children}
        {user && !viewer?.preview && <ChatWidget firstName={user.name.split(/\s+/)[0]} />}
      </body>
    </html>
  );
}

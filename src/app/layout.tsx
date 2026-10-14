import type { Metadata } from 'next';
import { Anton } from 'next/font/google';
import './globals.css';
import { getViewer } from '@/lib/auth/current-user';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { CommandPalette } from '@/components/CommandPalette';
import { ErrorReporter } from '@/components/ErrorReporter';

export const metadata: Metadata = {
  title: 'CW AI Task Hub',
  description: 'Club Wealth AI Task Hub: department automations and integrations.',
};

// The logo font, served from the hub itself (no extra trip to Google before the page can show).
const anton = Anton({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-anton' });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const user = viewer?.user;
  return (
    <html lang="en" className={anton.variable}>
      <body>
        {viewer?.preview && (
          <div className="preview-bar" role="status">
            <span>Previewing as <b>{viewer.user.name}</b> · read-only, chats are hidden</span>
            <a href="/api/preview?exit=1">Exit preview</a>
          </div>
        )}
        {children}
        {user && <ErrorReporter />}
        {user && <CommandPalette />}
        {user && !viewer?.preview && <ChatWidget firstName={user.name.split(/\s+/)[0]} />}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Anton } from 'next/font/google';
import './globals.css';
import { getViewer } from '@/lib/auth/current-user';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { CommandPalette } from '@/components/CommandPalette';
import { ErrorReporter } from '@/components/ErrorReporter';
import { UpdateNotice } from '@/components/UpdateNotice';
import { eodOnly } from '@/lib/access';

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
        {user && (
          // Signed-in pages are desktop only (Miguel): on a phone, this screen replaces the whole hub (CSS in globals.css).
          <div className="desktop-only" role="alert">
            <b>CLUBWEALTH</b>
            <p>Admin Hub viewable in desktop only</p>
            <span>Please open the hub on a computer.</span>
          </div>
        )}
        {viewer?.preview && (
          <div className="preview-bar" role="status">
            <span>Previewing as <b>{viewer.user.name}</b> · read-only, chats are hidden</span>
            <a href="/api/preview?exit=1">Exit preview</a>
          </div>
        )}
        {children}
        {user && <ErrorReporter />}
        {user && <UpdateNotice />}
        {user && !eodOnly(user) && <CommandPalette />}
        {user && !viewer?.preview && !eodOnly(user) && <ChatWidget firstName={user.name.split(/\s+/)[0]} />}
      </body>
    </html>
  );
}

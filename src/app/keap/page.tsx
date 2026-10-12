import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { notFound } from 'next/navigation';
import { KEAP_READS } from '@/lib/integrations/keap/capabilities';
import { keapConfigured } from '@/lib/integrations/keap/client';
import { KeapExplorer } from './KeapExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Keap · CW AI Task Hub' };

export default async function KeapPage() {
  const user = await requireUser();
  if (!isSuperAdmin(user)) notFound();
  return (
    <>
      <Header user={user} current="keap" />
      <KeapExplorer views={KEAP_READS.map(({ id, group, label, path, hint }) => ({ id, group, label, path, hint }))} connected={keapConfigured()} />
    </>
  );
}

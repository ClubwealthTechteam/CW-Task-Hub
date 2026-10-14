import { redirect } from 'next/navigation';

// Integrations moved into Admin settings.
export default function IntegrationsMoved() {
  redirect('/admin/integrations');
}

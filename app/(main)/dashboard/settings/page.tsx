import SettingsClient from './SettingsClient';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { user, profile } = await requirePageAccess();

  return (
    <SettingsClient 
      user={user} 
      profile={profile} 
    />
  );
}

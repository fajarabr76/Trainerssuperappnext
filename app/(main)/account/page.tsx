import AccountClient from './AccountClient';
import { requirePageAccess } from '@/app/lib/authz';

export default async function AccountPage() {
  await requirePageAccess();
  return <AccountClient />;
}

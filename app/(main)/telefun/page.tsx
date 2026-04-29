import TelefunClient from './TelefunClient';
import { requirePageAccess } from '@/app/lib/authz';

export default async function TelefunPage() {
  await requirePageAccess();
  return <TelefunClient />;
}

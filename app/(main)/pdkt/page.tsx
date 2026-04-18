import PdktClient from './PdktClient';
import { requirePageAccess } from '@/app/lib/authz';

export default async function PdktPage() {
  await requirePageAccess();
  return <PdktClient />;
}

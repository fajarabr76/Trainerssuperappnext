import KetikClient from './KetikClient';
import { requirePageAccess } from '@/app/lib/authz';

export default async function KetikPage() {
  await requirePageAccess();
  return <KetikClient />;
}

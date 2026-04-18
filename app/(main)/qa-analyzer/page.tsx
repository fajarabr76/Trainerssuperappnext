import { redirect } from 'next/navigation';
import { requirePageAccess } from '@/app/lib/authz';

export default async function QaAnalyzerIndexPage() {
  await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });
  
  redirect('/qa-analyzer/dashboard');
}

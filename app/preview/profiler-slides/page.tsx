import ProfilerSlidesPreviewClient from './ProfilerSlidesPreviewClient';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function ProfilerSlidesPreviewPage() {
  await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });
  
  return <ProfilerSlidesPreviewClient />;
}

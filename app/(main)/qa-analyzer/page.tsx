import { requirePageAccess } from '@/app/lib/authz';
import { checkSidakLeaderAccess } from './lib/leaderAccessGuard';
import LeaderAccessStatus from '@/app/components/access/LeaderAccessStatus';
import SidakLandingClient from './SidakLandingClient';

export const dynamic = 'force-dynamic';

export default async function QaAnalyzerIndexPage() {
  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  const leaderAccess = await checkSidakLeaderAccess();
  if (leaderAccess.blocked) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <LeaderAccessStatus status={leaderAccess.status} module="sidak" moduleLabel="SIDAK / QA Analyzer" />
      </div>
    );
  }

  return <SidakLandingClient role={role} />;
}

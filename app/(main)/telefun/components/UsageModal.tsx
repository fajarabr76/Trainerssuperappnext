'use client';

import { UsageModal as BaseUsageModal } from '@/app/(main)/ketik/components/UsageModal';
import type { UsageDelta } from '@/app/lib/usage-snapshot';

interface TelefunUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionDelta?: UsageDelta | null;
  sessionDeltaPending?: boolean;
}

export const UsageModal: React.FC<TelefunUsageModalProps> = (props) => (
  <BaseUsageModal {...props} module="telefun" />
);

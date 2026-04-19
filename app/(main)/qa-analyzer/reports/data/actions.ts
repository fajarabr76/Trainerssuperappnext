'use server';

import { requirePageAccess } from '@/app/lib/authz';
import type { ServiceType } from '../../lib/qa-types';
import { qaServiceServer } from '../../services/qaService.server';

export type DataReportFilter = {
  serviceType: ServiceType;
  indicatorId?: string;
  year: number;
  startMonth: number;
  endMonth: number;
  mode: 'layanan' | 'individu';
  pesertaId?: string;
  folderId?: string;
};

export async function fetchDataReportAction(filter: DataReportFilter) {
  await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  return await qaServiceServer.getDataReportRows({
    serviceType: filter.serviceType,
    indicatorId: filter.indicatorId,
    year: filter.year,
    startMonth: filter.startMonth,
    endMonth: filter.endMonth,
    folderId: filter.folderId,
    pesertaId: filter.mode === 'individu' ? filter.pesertaId : undefined,
  });
}

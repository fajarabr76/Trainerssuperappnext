'use server';

import { qaServiceServer } from "../qa-analyzer/services/qaService.server";

export async function getDashboardTrendByRangeAction(
  year: number,
  startMonth: number,
  endMonth: number
) {
  return await qaServiceServer.getServiceTrendForDashboardByRange(year, startMonth, endMonth);
}



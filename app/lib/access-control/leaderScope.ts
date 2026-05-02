import type { AppRole } from '@/app/lib/authz';
import { normalizeRole } from '@/app/lib/authz';

// --- Types ---

export interface AccessGroupItem {
  id: string;
  access_group_id: string;
  field_name: 'peserta_id' | 'batch_name' | 'tim' | 'service_type';
  field_value: string;
  is_active: boolean;
}

export interface LeaderScopeFilter {
  peserta_ids?: string[];
  batch_names?: string[];
  tims?: string[];
  service_types?: string[];
}

export type LeaderAccessStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'revoked';

export interface LeaderAccessInfo {
  hasAccess: boolean;
  status: LeaderAccessStatus;
  accessGroups: string[];
  scopeFilter: LeaderScopeFilter;
}

export type LeaderAccessModule = 'ktp' | 'sidak';

// --- Privileged role check ---

/**
 * Returns true for roles that have full data access and approval authority (admin, trainer).
 */
export function isPrivilegedRole(role: AppRole | string): boolean {
  const n = normalizeRole(role);
  return n === 'admin' || n === 'trainer';
}

// --- Scope resolver ---

/**
 * Resolve leader scope items into filter arrays for a given module.
 * Rules are union rules per field type.
 * KTP ignores service_type. SIDAK supports all four fields.
 * Only active items are included. Unrecognized module returns empty.
 */
export function resolveLeaderScope(
  module: LeaderAccessModule,
  items: AccessGroupItem[] | null | undefined,
): LeaderScopeFilter {
  if (!items || !Array.isArray(items)) return {};

  const activeItems = items.filter((i) => i.is_active && i.field_value?.trim());

  const result: LeaderScopeFilter = {};

  // KTP-relevant fields
  if (module === 'ktp' || module === 'sidak') {
    const pesertaIds = activeItems
      .filter((i) => i.field_name === 'peserta_id')
      .map((i) => i.field_value);
    if (pesertaIds.length > 0) {
      result.peserta_ids = [...new Set(pesertaIds)];
    }

    const batchNames = activeItems
      .filter((i) => i.field_name === 'batch_name')
      .map((i) => i.field_value);
    if (batchNames.length > 0) {
      result.batch_names = [...new Set(batchNames)];
    }

    const tims = activeItems
      .filter((i) => i.field_name === 'tim')
      .map((i) => i.field_value);
    if (tims.length > 0) {
      result.tims = [...new Set(tims)];
    }
  }

  // SIDAK-only field
  if (module === 'sidak') {
    const serviceTypes = activeItems
      .filter((i) => i.field_name === 'service_type')
      .map((i) => i.field_value);
    if (serviceTypes.length > 0) {
      result.service_types = [...new Set(serviceTypes)];
    }
  }

  return result;
}

'use client';

/**
 * Client-side feature flags.
 * TODO: Replace with your feature flag provider or fetch from /api/flags.
 */

const FLAGS: Record<string, boolean> = {
  enableOrders: true,
  enableUpload: true,
};

export function getFeatureFlag(flag: string): boolean {
  return FLAGS[flag] ?? false;
}

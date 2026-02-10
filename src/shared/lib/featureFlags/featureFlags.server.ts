import 'server-only';

/**
 * Server-side feature flags.
 * TODO: Replace with your feature flag provider (LaunchDarkly, Unleash, etc.)
 */

const FLAGS: Record<string, boolean> = {
  enableOrders: true,
  enableUpload: true,
};

export function getFeatureFlag(flag: string): boolean {
  return FLAGS[flag] ?? false;
}

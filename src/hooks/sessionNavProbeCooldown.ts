/** Min interval between navigation-triggered session refresh probes. */
export const SESSION_NAV_PROBE_COOLDOWN_MS = 45_000

export function shouldRunNavSessionProbe(
  lastProbeAtMs: number,
  nowMs: number,
  cooldownMs: number = SESSION_NAV_PROBE_COOLDOWN_MS,
): boolean {
  return nowMs - lastProbeAtMs >= cooldownMs
}

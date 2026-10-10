const GRAPPLE_PREFERENCE_KEY = 'mars-miner.grapple.v1';

/** The safety hook is opt-in per device once the player changes its default. */
export function loadGrappleEnabled() {
  try {
    return localStorage.getItem(GRAPPLE_PREFERENCE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveGrappleEnabled(enabled: boolean) {
  try {
    localStorage.setItem(GRAPPLE_PREFERENCE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Keep the in-session toggle usable when browser storage is unavailable.
  }
}

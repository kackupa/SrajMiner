import { parseSaveFile, SAVE_KEY, type SaveData } from '../save/SaveManager';

export const LOCAL_CAMPAIGN_ID_KEY = 'ore-frontier-local-campaign-id-v1';
export const LOCAL_RESTORE_SAFETY_PREFIX = 'ore-frontier-local-restore-safety-v1:';
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

export type PreparedLocalBackup = {
  campaign_id: string;
  save_schema: 32;
  payload: SaveData;
  byte_length: number;
};

const bytes = (value: string) => new TextEncoder().encode(value).length;

/** This payload is backup data only. No server economy endpoint may consume it. */
export function prepareLocalBackup(storage: Pick<Storage, 'getItem' | 'setItem'>): PreparedLocalBackup | null {
  let raw: string | null;
  try { raw = storage.getItem(SAVE_KEY); } catch { return null; }
  if (!raw || bytes(raw) > MAX_BACKUP_BYTES) return null;
  const payload = parseSaveFile(raw);
  if (!payload) return null;
  const normalized = JSON.stringify(payload);
  if (bytes(normalized) > MAX_BACKUP_BYTES) return null;
  let campaignId: string;
  try {
    campaignId = storage.getItem(LOCAL_CAMPAIGN_ID_KEY) ?? crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) return null;
    storage.setItem(LOCAL_CAMPAIGN_ID_KEY, campaignId);
  } catch { return null; }
  return { campaign_id: campaignId, save_schema: 32, payload, byte_length: bytes(normalized) };
}

export type LocalRestoreResult = { restored: true; safety_copy_key: string | null } | { restored: false; reason: 'invalid' | 'too_large' | 'storage_unavailable' };

/** Call only after an explicit restore choice; preserve destination bytes first. */
export function restoreLocalBackup(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, backedUpPayload: unknown, campaignId?: string): LocalRestoreResult {
  if (campaignId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId))
    return { restored: false, reason: 'invalid' };
  let raw: string | undefined;
  try { raw = JSON.stringify(backedUpPayload); } catch { return { restored: false, reason: 'invalid' }; }
  if (typeof raw !== 'string') return { restored: false, reason: 'invalid' };
  if (bytes(raw) > MAX_BACKUP_BYTES) return { restored: false, reason: 'too_large' };
  const save = parseSaveFile(raw);
  if (!save) return { restored: false, reason: 'invalid' };
  const normalized = JSON.stringify(save);
  if (bytes(normalized) > MAX_BACKUP_BYTES) return { restored: false, reason: 'too_large' };
  try {
    const previous = storage.getItem(SAVE_KEY);
    const previousCampaignId = storage.getItem(LOCAL_CAMPAIGN_ID_KEY);
    const safetyKey = previous ? `${LOCAL_RESTORE_SAFETY_PREFIX}${Date.now()}:${crypto.randomUUID()}` : null;
    if (safetyKey && previous) {
      storage.setItem(safetyKey, previous);
      if (previousCampaignId) storage.setItem(`${safetyKey}:campaign-id`, previousCampaignId);
    }
    if (campaignId) storage.setItem(LOCAL_CAMPAIGN_ID_KEY, campaignId);
    try {
      storage.setItem(SAVE_KEY, normalized);
    } catch {
      if (campaignId) {
        if (previousCampaignId) storage.setItem(LOCAL_CAMPAIGN_ID_KEY, previousCampaignId);
        else storage.removeItem(LOCAL_CAMPAIGN_ID_KEY);
      }
      return { restored: false, reason: 'storage_unavailable' };
    }
    return { restored: true, safety_copy_key: safetyKey };
  } catch {
    return { restored: false, reason: 'storage_unavailable' };
  }
}

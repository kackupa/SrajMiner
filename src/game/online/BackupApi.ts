import { parseSaveFile, type SaveData } from '../save/SaveManager';
import { MAX_BACKUP_BYTES, type PreparedLocalBackup } from './LocalBackup';
import { onlineAuthClient } from './AuthClient';

export type BackupReceipt = {
  operation_id: string;
  campaign_id: string;
  backup_id: string;
  revision: number;
  saved_at: string;
};
export type BackupSummary = {
  id: string;
  campaign_id: string;
  revision: number;
  save_schema: 32;
  created_at: string;
};

const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const receipt = (value: unknown): value is BackupReceipt => object(value) &&
  uuid(value.operation_id) && uuid(value.campaign_id) && uuid(value.backup_id) &&
  revision(value.revision) && typeof value.saved_at === 'string' && !Number.isNaN(Date.parse(value.saved_at));

/** Keep the same operation ID across a network retry. A new ID can create another version. */
export async function uploadLocalBackup(
  backup: PreparedLocalBackup,
  expectedRevision: number,
  operationId: string,
): Promise<BackupReceipt> {
  if (!uuid(backup.campaign_id) || backup.save_schema !== 32 ||
    !revision(expectedRevision) || !uuid(operationId)) throw new Error('Invalid backup request.');
  const auth = onlineAuthClient();
  if (!auth) throw new Error('Online backups are not configured.');
  const { data, error } = await auth.rpc('backup_local_campaign', {
    p_campaign_id: backup.campaign_id,
    p_expected_revision: expectedRevision,
    p_operation_id: operationId,
    p_save_schema: backup.save_schema,
    p_payload: backup.payload,
  });
  if (error) {
    if (error.message.includes('STALE_REVISION')) throw new Error('Backup changed on another device. Refresh before saving.');
    if (error.message.includes('OPERATION_CONFLICT')) throw new Error('This backup request ID was already used for different data.');
    throw new Error('Backup could not be saved. Check your connection and sign-in.');
  }
  if (!receipt(data) || data.operation_id !== operationId || data.campaign_id !== backup.campaign_id ||
    data.revision !== expectedRevision + 1) throw new Error('Backup response was invalid. Refresh before saving again.');
  return data;
}

/** Supabase RLS restricts these rows to the signed-in owner. */
export async function listLocalBackups(campaignId: string): Promise<BackupSummary[]> {
  if (!uuid(campaignId)) throw new Error('Invalid campaign ID.');
  const auth = onlineAuthClient();
  if (!auth) throw new Error('Online backups are not configured.');
  const { data, error } = await auth.from('local_campaign_backups')
    .select('id,campaign_id,revision,save_schema,created_at')
    .eq('campaign_id', campaignId).order('revision', { ascending: false }).limit(5);
  if (error || !Array.isArray(data)) throw new Error('Backups could not be loaded.');
  if (!data.every(row => uuid(row.id) && row.campaign_id === campaignId &&
    revision(row.revision) && row.save_schema === 32 &&
    typeof row.created_at === 'string' && !Number.isNaN(Date.parse(row.created_at))))
    throw new Error('Backup list contained invalid data.');
  return data as BackupSummary[];
}

/** Discover an account's Local campaigns on a second device without a local ID. */
export async function listRecentLocalBackups(): Promise<BackupSummary[]> {
  const auth = onlineAuthClient();
  if (!auth) throw new Error('Online backups are not configured.');
  const { data, error } = await auth.from('local_campaign_backups')
    .select('id,campaign_id,revision,save_schema,created_at')
    .order('created_at', { ascending: false }).limit(20);
  if (error || !Array.isArray(data)) throw new Error('Backups could not be loaded.');
  if (!data.every(row => uuid(row.id) && uuid(row.campaign_id) &&
    revision(row.revision) && row.save_schema === 32 &&
    typeof row.created_at === 'string' && !Number.isNaN(Date.parse(row.created_at))))
    throw new Error('Backup list contained invalid data.');
  return data as BackupSummary[];
}

/** Return validated data only; the caller must ask before explicit local restore. */
export async function downloadLocalBackup(campaignId: string, backupId: string): Promise<SaveData> {
  if (!uuid(campaignId) || !uuid(backupId)) throw new Error('Invalid backup ID.');
  const auth = onlineAuthClient();
  if (!auth) throw new Error('Online backups are not configured.');
  const { data, error } = await auth.from('local_campaign_backups')
    .select('payload,save_schema').eq('campaign_id', campaignId).eq('id', backupId).single();
  if (error || !data || data.save_schema !== 32) throw new Error('Backup could not be loaded.');
  let raw: string;
  try { raw = JSON.stringify(data.payload); } catch { throw new Error('Backup data was invalid.'); }
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('Backup data was too large.');
  const save = parseSaveFile(raw);
  if (!save) throw new Error('Backup data was invalid.');
  return save;
}

// Supabase Edge Function. The service key exists only in this runtime.
// engine.js is built from the shared, versioned TypeScript game rules.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { executeVerifiedGameBatch } from './engine.js';

const url = Deno.env.get('SUPABASE_URL');
const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const allowedOrigins = new Set((Deno.env.get('GAME_ORIGINS') ?? 'http://127.0.0.1:5173')
  .split(',').map(origin => origin.trim()).filter(Boolean));
if (!url || !publicKey || !serviceKey) throw new Error('SERVER_CONFIGURATION');
const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function response(status: number, payload: unknown, origin: string | null): Response {
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  if (origin && allowedOrigins.has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
    headers.set('access-control-allow-headers', 'authorization, apikey, content-type');
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
  }
  return new Response(status === 204 ? null : JSON.stringify(payload), { status, headers });
}

const safeCodes = new Set(['INVALID_COMMAND', 'INVALID_STATE', 'ACCESS_REQUIRED', 'RULESET_MISMATCH',
  'STALE_REVISION', 'SESSION_CONFLICT', 'OPERATION_CONFLICT', 'RATE_LIMITED', 'HOLD_FULL']);
function queryValue<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('INVALID_STATE');
  return result.data;
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) return response(403, { code: 'ACCESS_REQUIRED' }, null);
  if (request.method === 'OPTIONS') return response(204, null, origin);
  if (request.method !== 'POST') return response(405, { code: 'INVALID_COMMAND' }, origin);
  if (Number(request.headers.get('content-length') ?? 0) > 16_384) return response(413, { code: 'INVALID_COMMAND' }, origin);
  const bearer = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!bearer) return response(401, { code: 'AUTH_REQUIRED' }, origin);
  try {
    const { data: userData, error: authError } = await auth.auth.getUser(bearer[1]);
    if (authError || !userData.user) return response(401, { code: 'AUTH_REQUIRED' }, origin);
    const body = await request.text();
    if (body.length > 16_384) return response(413, { code: 'INVALID_COMMAND' }, origin);
    const command = JSON.parse(body);
    const repository = {
      async hasOperation(ownerId: string, operationId: string) {
        const result = await admin.from('online_game_operations').select('operation_id')
          .eq('owner_id', ownerId).eq('operation_id', operationId).maybeSingle();
        if (result.error) throw new Error(result.error.message);
        return result.data !== null;
      },
      async campaign(campaignId: string) {
        const result = await admin.from('online_campaigns')
          .select('id,owner_id,ruleset_version,revision,active_planet').eq('id', campaignId).maybeSingle();
        if (result.error) throw new Error(result.error.message);
        return result.data;
      },
      async simulation(campaignId: string) {
        const result = await admin.from('online_simulation_state').select('snapshot')
          .eq('campaign_id', campaignId).single();
        return queryValue(result).snapshot;
      },
      async minerInventory(campaignId: string) {
        const result = await admin.from('online_inventory').select('ore,quantity_half_units')
          .eq('campaign_id', campaignId).eq('location_key', 'miner');
        return queryValue(result);
      },
      async commit(args: {
        owner_id: string; campaign_id: string; expected_revision: number;
        operation_id: string; session_id: string; input: unknown; new_state: Record<string, unknown>;
      }) {
        const result = await admin.rpc('commit_online_game_step', {
          p_owner_id: args.owner_id, p_campaign_id: args.campaign_id,
          p_expected_revision: args.expected_revision, p_operation_id: args.operation_id,
          p_session_id: args.session_id, p_input: args.input, p_new_state: args.new_state,
        });
        return queryValue(result);
      },
    };
    const receipt = await executeVerifiedGameBatch(command, userData.user.id, repository, Date.now());
    return response(200, receipt, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = safeCodes.has(message) ? message : 'SERVER_ERROR';
    const status = code === 'ACCESS_REQUIRED' ? 403 : code === 'STALE_REVISION' ||
      code === 'SESSION_CONFLICT' || code === 'OPERATION_CONFLICT' ? 409 :
      code === 'SERVER_ERROR' ? 500 : 400;
    return response(status, { code }, origin);
  }
});

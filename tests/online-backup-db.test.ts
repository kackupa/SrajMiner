import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
  create role authenticated;
  create role anon;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261019000000_local_campaign_backups.sql', import.meta.url), 'utf8'));

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const campaign = '33333333-3333-4333-8333-333333333333';
const operation = '44444444-4444-4444-8444-444444444444';
await db.query('insert into auth.users(id) values ($1), ($2)', [alice, bob]);
await db.exec(`grant usage on schema public, auth to authenticated; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}';`);

async function backup(op: string, expected: number, payload: object, ownerCampaign = campaign) {
  const result = await db.query<{ receipt: { revision: number; backup_id: string; operation_id: string } }>(
    'select public.backup_local_campaign($1::uuid, $2::bigint, $3::uuid, 32, $4::jsonb) as receipt',
    [ownerCampaign, expected, op, JSON.stringify(payload)],
  );
  return result.rows[0]!.receipt;
}

const payload = { version: 32, money: 99, cargo: { nickel: 14 } };
const first = await backup(operation, 0, payload);
assert.equal(first.revision, 1);
assert.equal(first.operation_id, operation);
assert.deepEqual(await backup(operation, 0, payload), first, 'lost response must return the exact receipt');
assert.equal((await db.query('select count(*)::integer as count from public.local_campaign_backups')).rows[0]?.count, 1);
await assert.rejects(backup(operation, 0, { ...payload, money: 100 }), /OPERATION_CONFLICT/);
await assert.rejects(backup('55555555-5555-4555-8555-555555555555', 0, payload), /STALE_REVISION/);
await assert.rejects(backup('66666666-6666-4666-8666-666666666666', 1, { ...payload, version: 31 }), /INVALID_COMMAND/);
await assert.rejects(db.query('insert into public.local_campaign_backups(owner_id,campaign_id,revision,save_schema,payload) values ($1,$2,9,32,$3::jsonb)', [alice, campaign, '{}']), /permission denied|row-level security/i);

await db.exec(`set request.jwt.claim.sub = '${bob}';`);
assert.equal((await db.query('select count(*)::integer as count from public.local_campaign_backups')).rows[0]?.count, 0, 'another owner cannot read backup data');
await assert.rejects(db.query('select * from public.local_backup_operations'), /permission denied/i);
const bobReceipt = await backup('77777777-7777-4777-8777-777777777777', 0, { version: 32 }, campaign);
assert.equal(bobReceipt.revision, 1, 'same campaign UUID remains owner-scoped');

await db.exec(`set request.jwt.claim.sub = '${alice}';`);
for (let revision = 1; revision <= 6; revision++) {
  await backup(`00000000-0000-4000-8000-${String(revision).padStart(12, '0')}`, revision, payload);
}
const retained = (await db.query<{ revision: string }>('select revision::text from public.local_campaign_backups order by revision')).rows.map(row => Number(row.revision));
assert.deepEqual(retained, [3, 4, 5, 6, 7], 'only five recent versions remain');
assert.deepEqual(await backup(operation, 0, payload), first, 'receipt survives snapshot pruning');
await db.close();
console.log('PASS local backup SQL: owner isolation, direct-write denial, revision, idempotency, five-version retention');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const db = new PGlite();
await db.exec(`
  create role authenticated;
  create role anon;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select current_setting('request.jwt.claim.role', true)
  $$;
  grant usage on schema public, auth to authenticated, anon;
  grant execute on function auth.uid(), auth.role() to authenticated, anon;
`);
await db.exec(migration('20261019000001_verified_online_foundation.sql'));
await db.exec(migration('20261019000002_verified_online_start.sql'));
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
await db.query('insert into auth.users(id) values ($1), ($2)', [alice, bob]);

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
const start = (id: string) => db.query<{ start_online_campaign: { operation_id: string; campaign_id: string; revision: number; credit_minor: number; active_planet: string } }>(
  'select public.start_online_campaign($1,$2::uuid)', ['online-1', id]);
const first = (await start('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rows[0]!.start_online_campaign;
const retry = (await start('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rows[0]!.start_online_campaign;
const otherKey = (await start('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).rows[0]!.start_online_campaign;
assert.deepEqual(retry, first, 'same operation returns same campaign');
assert.equal(otherKey.campaign_id, first.campaign_id, 'new operation cannot issue a second campaign');
assert.equal(otherKey.credit_minor, 0);
assert.notEqual(otherKey.operation_id, first.operation_id);
assert.equal(first.revision, 0);
assert.equal(first.active_planet, 'cryo-shelf');
assert.equal(first.credit_minor, 0);
assert.equal((await db.query('select count(*)::integer as count from public.online_inventory')).rows[0]?.count, 0);
await assert.rejects(db.query('select public.start_online_campaign($1,$2::uuid)', ['online-2', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']), /RULESET_MISMATCH/);
await assert.rejects(db.query('select public.start_online_campaign($1,$2::uuid)', ['online-2', first.operation_id]), /OPERATION_CONFLICT/);
await assert.rejects(db.query('update public.online_wallets set credit_minor = 999'), /permission denied|row-level security/i);

await db.exec('reset role');
await db.query('update public.online_campaigns set revision = 1 where id = $1', [first.campaign_id]);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
assert.deepEqual((await start(first.operation_id)).rows[0]!.start_online_campaign, first, 'retry returns original receipt after later state changes');

await db.exec(`set request.jwt.claim.sub = '${bob}';`);
const second = (await start('dddddddd-dddd-4ddd-8ddd-dddddddddddd')).rows[0]!.start_online_campaign;
assert.notEqual(second.campaign_id, first.campaign_id);
assert.equal(second.credit_minor, 0);
assert.equal((await db.query('select count(*)::integer as count from public.online_campaigns')).rows[0]?.count, 1, 'RLS hides the first campaign');

await db.exec(`reset role; set role anon; set request.jwt.claim.sub = ''; set request.jwt.claim.role = 'anon';`);
await assert.rejects(start('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), /permission denied|AUTH_REQUIRED/i);
await db.exec('reset role');
assert.equal((await db.query('select count(*)::integer as count from public.online_campaigns')).rows[0]?.count, 2);
assert.equal((await db.query('select sum(credit_minor)::integer as total from public.online_wallets')).rows[0]?.total, 0);
assert.equal((await db.query('select count(*)::integer as count from public.online_inventory')).rows[0]?.count, 0);
await db.close();
console.log('PASS online start: one zero-asset campaign per owner, retries stable, direct writes denied');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const db = new PGlite();
await db.exec(`
  create role authenticated;
  create role anon;
  create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select current_setting('request.jwt.claim.role', true)
  $$;
`);
await db.exec(migration('20261017000000_player_market.sql'));
await db.exec(migration('20261017000001_market_beta_starter_balances.sql'));
await db.exec(migration('20261019000001_verified_online_foundation.sql'));

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const campaign = '33333333-3333-4333-8333-333333333333';
await db.query('insert into auth.users(id) values ($1), ($2)', [alice, bob]);
const legacy = await db.query<{ available_credits: string }>('select available_credits::text from public.market_wallets where user_id = $1', [alice]);
assert.equal(legacy.rows[0]?.available_credits, '5000', 'historical beta starter still populates only legacy wallet');
assert.equal((await db.query('select count(*)::integer as count from public.online_wallets')).rows[0]?.count, 0);
assert.equal((await db.query('select count(*)::integer as count from public.online_inventory')).rows[0]?.count, 0);

// A test-only admin insertion represents a future server-issued zero-balance campaign.
await db.query('insert into public.online_campaigns(id,owner_id,ruleset_version,active_planet) values ($1,$2,$3,$4)', [campaign, alice, 'online-1', 'cryo-shelf']);
await db.query('insert into public.online_wallets(campaign_id,owner_id) values ($1,$2)', [campaign, alice]);
await db.exec(`grant usage on schema public, auth to authenticated, service_role; grant execute on function auth.uid(), auth.role() to authenticated, service_role;`);
await db.exec(`set role service_role; set request.jwt.claim.role = 'service_role';`);
await db.query('select public.market_admin_grant($1::uuid,$2,$3,$4::bigint)', [alice, 'nickel', 5, 100]);
await db.exec('reset role');
assert.equal((await db.query<{ credit_minor: string }>('select credit_minor::text from public.online_wallets where campaign_id = $1', [campaign])).rows[0]?.credit_minor, '0', 'legacy admin grant cannot credit verified wallet');
assert.equal((await db.query('select count(*)::integer as count from public.online_inventory')).rows[0]?.count, 0, 'legacy grant cannot mint verified ore');

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
assert.equal((await db.query('select count(*)::integer as count from public.online_campaigns')).rows[0]?.count, 1);
assert.equal((await db.query('select count(*)::integer as count from public.online_wallets')).rows[0]?.count, 1);
await assert.rejects(db.query('update public.online_wallets set credit_minor = 999 where campaign_id = $1', [campaign]), /permission denied|row-level security/i);
await assert.rejects(db.query('insert into public.online_inventory(campaign_id,owner_id,location_key,ore,quantity_half_units) values ($1,$2,$3,$4,$5)', [campaign, alice, 'ship', 'nickel', 50]), /permission denied|row-level security/i);
await db.exec(`set request.jwt.claim.sub = '${bob}';`);
assert.equal((await db.query('select count(*)::integer as count from public.online_campaigns')).rows[0]?.count, 0);
assert.equal((await db.query('select count(*)::integer as count from public.online_wallets')).rows[0]?.count, 0);
await db.close();
console.log('PASS verified foundation: legacy beta starter/grant isolated; direct writes denied; owner reads scoped');

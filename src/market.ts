import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './market.css';

const ores = [
  ['copper', 'Copper', '#f29b63'],
  ['iron', 'Iron', '#a9bec4'],
  ['silver', 'Silver', '#d7efe8'],
  ['gold', 'Gold', '#ffd15e'],
  ['diamond', 'Diamond', '#60e5d3'],
  ['nickel', 'Nickel', '#b6cb7a'],
  ['titanium', 'Titanium', '#91b6ff'],
  ['cobalt', 'Cobalt', '#6485f4'],
  ['cryocrystal', 'Cryocrystal', '#b5f1ff'],
] as const;
type Ore = (typeof ores)[number][0];
type Side = 'sell' | 'buy';
type Listing = {
  id: string;
  owner_id: string;
  side: Side;
  ore: Ore;
  original_units: number;
  remaining_units: number;
  unit_price: number;
  status: 'open' | 'filled' | 'cancelled';
  created_at: string;
};
type Wallet = { available_credits: number; reserved_credits: number };
type Inventory = { ore: Ore; available_units: number; reserved_units: number };
type Session = { access_token: string; refresh_token: string; expires_at: number };
type DialogAction = { title: string; body: string; run: () => Promise<void> };

const root = document.querySelector<HTMLElement>('#market-app')!;
const apiUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const configured = !!apiUrl && !!anonKey;
const storageKey = 'ore-frontier-market-session-v1';
let session: Session | undefined;
let userId = '';
let currentOre: Ore = 'copper';
let side: Side = 'sell';
let listings: Listing[] = [];
let wallet: Wallet = { available_credits: 0, reserved_credits: 0 };
let inventory: Inventory[] = [];
let notice = '';
let noticeKind: 'good' | 'bad' | 'neutral' = 'neutral';
let pending: DialogAction | undefined;
let refreshTimer = 0;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const oreInfo = (ore: Ore) => ores.find(([key]) => key === ore)!;
const money = (value: number) => Math.floor(Number(value) || 0).toLocaleString();
const dateAge = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
};

function saveSession(value?: Session) {
  session = value;
  if (value) localStorage.setItem(storageKey, JSON.stringify(value));
  else localStorage.removeItem(storageKey);
}

function readSession() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  const expiresIn = Number(fragment.get('expires_in') || 3600);
  if (accessToken && refreshToken) {
    saveSession({ access_token: accessToken, refresh_token: refreshToken, expires_at: Date.now() + expiresIn * 1000 });
    history.replaceState({}, '', `${location.pathname}${location.search}`);
  } else {
    try { session = JSON.parse(localStorage.getItem(storageKey) || 'null') || undefined; }
    catch { saveSession(); }
  }
}

async function authRequest(path: string, body: unknown) {
  const response = await fetch(`${apiUrl}/auth/v1/${path}`, {
    method: 'POST', headers: { apikey: anonKey!, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.msg || json.message || json.error_description || 'Could not reach account service.');
  return json;
}

async function ensureSession() {
  if (!session) throw new Error('Sign in to use the player market.');
  if (session.expires_at > Date.now() + 30_000) return session;
  const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
  saveSession({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000 });
  return session!;
}

async function api(path: string, init: RequestInit = {}) {
  const active = await ensureSession();
  const response = await fetch(`${apiUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: anonKey!, Authorization: `Bearer ${active.access_token}`, 'content-type': 'application/json', ...init.headers },
  });
  if (response.status === 401) { saveSession(); throw new Error('Your sign-in expired. Request a fresh sign-in link.'); }
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(result?.message || result?.details || 'Market request failed. Refresh and try again.');
  return result;
}

async function getUser() {
  const active = await ensureSession();
  const response = await fetch(`${apiUrl}/auth/v1/user`, { headers: { apikey: anonKey!, Authorization: `Bearer ${active.access_token}` } });
  if (!response.ok) { saveSession(); throw new Error('Your sign-in expired. Request a fresh sign-in link.'); }
  return response.json();
}

async function sendSignIn(email: string) {
  await authRequest(`otp?redirect_to=${encodeURIComponent(`${location.origin}${location.pathname}`)}`, { email, create_user: true });
  announce('Check your email for the Ore Frontier sign-in link.', 'good');
}

async function loadData() {
  const user = await getUser();
  userId = user.id;
  const [walletRows, inventoryRows, orderRows, ownOrderRows] = await Promise.all([
    api(`market_wallets?select=available_credits,reserved_credits&user_id=eq.${encodeURIComponent(userId)}&limit=1`),
    api(`market_inventory?select=ore,available_units,reserved_units&user_id=eq.${encodeURIComponent(userId)}&order=ore.asc`),
    api(`market_listings?select=id,owner_id,side,ore,original_units,remaining_units,unit_price,status,created_at&status=eq.open&ore=eq.${currentOre}&order=unit_price.asc,created_at.asc&limit=100`),
    api(`market_listings?select=id,owner_id,side,ore,original_units,remaining_units,unit_price,status,created_at&status=eq.open&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=10`),
  ]);
  wallet = walletRows?.[0] ?? { available_credits: 0, reserved_credits: 0 };
  inventory = inventoryRows ?? [];
  listings = [...new Map([...(orderRows ?? []), ...(ownOrderRows ?? [])].map(item => [item.id, item])).values()];
  render();
}

function announce(message: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  notice = message;
  noticeKind = kind;
  render();
}

function openConfirmation(action: DialogAction) {
  pending = action;
  render();
}

function quantityInput(id: string, max: number, label: string) {
  return `<label class="market-field"><span>${label}</span><div class="stepper"><button type="button" data-step="${id}" data-delta="-1" aria-label="Decrease ${label}">−</button><input id="${id}" aria-label="${label}" type="number" min="1" max="${Math.max(1, max)}" step="1" value="1" inputmode="numeric"><button type="button" data-step="${id}" data-delta="1" aria-label="Increase ${label}">+</button></div></label>`;
}

function inventoryFor(ore: Ore) { return inventory.find(row => row.ore === ore)?.available_units ?? 0; }
function myOpenListings() { return listings.filter(item => item.owner_id === userId); }
function bookRows(sideToShow: Side) {
  const rows = listings.filter(item => item.ore === currentOre && item.side === sideToShow && item.owner_id !== userId)
    .sort((a, b) => sideToShow === 'sell' ? a.unit_price - b.unit_price || Date.parse(a.created_at) - Date.parse(b.created_at) : b.unit_price - a.unit_price || Date.parse(a.created_at) - Date.parse(b.created_at));
  if (!rows.length) return `<div class="market-empty">No ${sideToShow === 'sell' ? 'sell offers' : 'buy offers'} for ${esc(oreInfo(currentOre)[1])} yet.</div>`;
  return rows.map(row => `<article class="order-row">
    <div class="order-price"><b>${money(row.unit_price)}</b><small>TEST CREDITS / UNIT</small></div>
    <div class="order-quantity"><b>${row.remaining_units.toLocaleString()}</b><small>AVAILABLE</small></div>
    <div class="order-time">${dateAge(row.created_at)}</div>
    ${quantityInput(`fill-${row.id}`, row.remaining_units, 'UNITS')}
    <button class="market-action compact" type="button" data-fill="${esc(row.id)}">${row.side === 'sell' ? 'BUY ORE' : 'SELL ORE'}</button>
  </article>`).join('');
}

function render() {
  if (!configured) {
    root.innerHTML = `<section class="config-screen"><a class="market-wordmark" href="/">ORE <em>FRONTIER</em></a><div class="config-card"><span class="eyebrow">PLAYER EXCHANGE · PRIVATE BETA</span><h1>THE MARKET IS<br><em>COMING ONLINE.</em></h1><p>The global market is in private beta setup. This build has no database credentials configured, so it cannot sign in or trade yet.</p><a class="market-action" href="/">BACK TO ORE FRONTIER</a><small>Only the public Supabase URL and publishable key belong in this page. Never add a service-role key here.</small></div></section>`;
    return;
  }
  if (!session) {
    root.innerHTML = `<section class="auth-screen"><a class="market-wordmark" href="/">ORE <em>FRONTIER</em></a><div class="auth-card"><span class="eyebrow">PLAYER EXCHANGE · PRIVATE BETA</span><h1>TRADE WITH<br><em>THE FRONTIER.</em></h1><p>Sign in with an email link to open your separate market vault. Campaign saves never add ore or credits to this account.</p><form id="signin-form"><label class="market-field"><span>EMAIL ADDRESS</span><input id="signin-email" type="email" autocomplete="email" required placeholder="you@example.com"></label><button class="market-action" type="submit">EMAIL ME A SIGN-IN LINK <span>↗</span></button></form><small>Test credits and market ore are separate from the offline campaign. They have no cash or token value.</small>${notice ? `<p class="notice ${noticeKind}" role="status">${esc(notice)}</p>` : ''}</div></section>`;
    bind();
    return;
  }
  const oreLabel = oreInfo(currentOre)[1];
  const oreColor = oreInfo(currentOre)[2];
  const asks = listings.filter(item => item.ore === currentOre && item.side === 'sell' && item.owner_id !== userId).sort((a, b) => a.unit_price - b.unit_price);
  const bids = listings.filter(item => item.ore === currentOre && item.side === 'buy' && item.owner_id !== userId).sort((a, b) => b.unit_price - a.unit_price);
  root.innerHTML = `<section class="market-shell">
    <header class="market-topbar"><a class="market-wordmark" href="/">ORE <em>FRONTIER</em></a><div class="market-heading"><span class="eyebrow">PLAYER EXCHANGE · PRIVATE BETA</span><b>GLOBAL ORE MARKET</b></div><div class="market-account"><span class="online-dot"></span><span>CONNECTED</span><button type="button" id="signout">SIGN OUT</button></div></header>
    <div class="market-status"><div><span>AVAILABLE TEST CREDITS</span><b>${money(wallet.available_credits)}</b><small>${money(wallet.reserved_credits)} reserved in buy orders</small></div><div><span>AVAILABLE ${esc(oreLabel).toUpperCase()}</span><b>${inventoryFor(currentOre).toLocaleString()}</b><small>reserved ore cannot be listed twice</small></div><div class="market-note">TEST ECONOMY · NO ON-CHAIN TOKEN OR LOCAL SAVE ASSETS</div></div>
    <nav class="ore-tabs" aria-label="Choose ore">${ores.map(([key, name, color]) => `<button type="button" class="ore-tab ${key === currentOre ? 'selected' : ''}" style="--ore:${color}" data-ore="${key}" aria-pressed="${key === currentOre}"><i></i>${name}</button>`).join('')}</nav>
    <main class="market-content">
      <section class="market-panel orderbook"><div class="panel-heading"><div><span class="eyebrow">LIVE ORDER BOOK</span><h1><i style="--ore:${oreColor}"></i>${esc(oreLabel)}</h1></div><button type="button" class="icon-button" id="refresh" aria-label="Refresh market">↻</button></div>
        <div class="book-head"><span>PRICE</span><span>QUANTITY</span><span>POSTED</span><span>TRADE</span></div>
        <section class="book-side"><div class="side-title sell-title"><b>SELL OFFERS</b><span>LOWEST ASK</span></div>${bookRows('sell')}</section>
        <div class="spread-line"><span>SPREAD</span><b>${asks.length && bids.length ? `${money(Math.max(0, asks[0]!.unit_price - bids[0]!.unit_price))} TEST CREDITS` : 'N/A'}</b><small>Prices are set by players. Fills settle atomically.</small></div>
        <section class="book-side"><div class="side-title buy-title"><b>BUY OFFERS</b><span>HIGHEST BID</span></div>${bookRows('buy')}</section>
        <p class="fine-print">Order book refreshes every 15 seconds. Database transactions settle every fill; stale orders are rejected safely.</p>
      </section>
      <aside class="market-panel trade-panel"><span class="eyebrow">POST AN ORDER</span><h2>Set your price.</h2><div class="side-switch" role="group" aria-label="Order direction"><button type="button" data-side="sell" aria-pressed="${side === 'sell'}" class="${side === 'sell' ? 'selected' : ''}">SELL ORE</button><button type="button" data-side="buy" aria-pressed="${side === 'buy'}" class="${side === 'buy' ? 'selected' : ''}">BUY ORE</button></div>
        ${quantityInput('listing-units', side === 'sell' ? inventoryFor(currentOre) : 1000, 'QUANTITY')}
        <label class="market-field"><span>UNIT PRICE · TEST CREDITS</span><div class="stepper"><button type="button" data-step="listing-price" data-delta="-1" aria-label="Decrease unit price">−</button><input id="listing-price" aria-label="Unit price in test credits" type="number" min="1" max="100000" step="1" value="1" inputmode="numeric"><button type="button" data-step="listing-price" data-delta="1" aria-label="Increase unit price">+</button></div></label>
        <div class="settlement-preview"><span>ORDER RESERVATION</span><b id="reservation-preview">${side === 'sell' ? 'Ore is reserved when posted' : '1 test credit'}</b><small>${side === 'sell' ? 'Unfilled ore returns to your vault when cancelled.' : 'Credits are reserved up front; unspent credits return when cancelled.'}</small></div>
        <button type="button" class="market-action full-width" id="create-order">POST ${side.toUpperCase()} ORDER <span>↗</span></button>
        <div class="my-orders"><div class="panel-heading"><div><span class="eyebrow">YOUR OPEN ORDERS</span><h3>${myOpenListings().length} / 10</h3></div></div>${myOpenListings().length ? myOpenListings().map(item => `<div class="my-order"><span>${item.side.toUpperCase()} · ${esc(oreInfo(item.ore)[1])}</span><b>${item.remaining_units} @ ${money(item.unit_price)}</b><button type="button" data-cancel="${esc(item.id)}">CANCEL</button></div>`).join('') : '<p class="market-empty small">Your open orders will appear here.</p>'}</div>
        ${notice ? `<p class="notice ${noticeKind}" role="status">${esc(notice)}</p>` : ''}
      </aside>
    </main>
    <footer class="market-footer"><span>ORE FRONTIER · PLAYER EXCHANGE</span><span>TEST CREDITS HAVE NO CASH OR TOKEN VALUE</span><a href="/play">RETURN TO THE GAME ↗</a></footer>
  </section>
  ${pending ? `<div class="confirm-scrim"><section class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><span class="eyebrow">CHECK BEFORE SETTLEMENT</span><h2 id="confirm-title">${esc(pending.title)}</h2><p>${esc(pending.body)}</p><div class="confirm-actions"><button type="button" id="confirm-cancel">GO BACK</button><button type="button" class="market-action" id="confirm-submit">CONFIRM</button></div></section></div>` : ''}`;
  bind();
  updatePreview();
}

function updatePreview() {
  const units = Math.max(1, Number(document.querySelector<HTMLInputElement>('#listing-units')?.value || 1));
  const price = Math.max(1, Number(document.querySelector<HTMLInputElement>('#listing-price')?.value || 1));
  const preview = document.querySelector('#reservation-preview');
  if (preview) preview.textContent = side === 'sell' ? `${units.toLocaleString()} ${oreInfo(currentOre)[1]} reserved` : `${money(units * price)} test credits reserved`;
}

function bind() {
  document.querySelector<HTMLFormElement>('#signin-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.querySelector<HTMLInputElement>('#signin-email')?.value.trim();
    if (!email) return;
    try { await sendSignIn(email); }
    catch (error) { announce(error instanceof Error ? error.message : 'Could not request a sign-in link.', 'bad'); }
  });
  document.querySelector('#signout')?.addEventListener('click', () => { saveSession(); userId = ''; clearInterval(refreshTimer); notice = 'Signed out.'; render(); });
  document.querySelectorAll<HTMLButtonElement>('[data-ore]').forEach(button => button.addEventListener('click', () => {
    currentOre = button.dataset.ore as Ore;
    void loadData().catch(error => announce(error instanceof Error ? error.message : 'Market refresh failed.', 'bad'));
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(button => button.addEventListener('click', () => { side = button.dataset.side as Side; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.step!) as HTMLInputElement | null;
    if (!input) return;
    input.value = String(Math.max(Number(input.min || 1), Math.min(Number(input.max || 100000), Number(input.value || 1) + Number(button.dataset.delta))));
    updatePreview();
  }));
  document.querySelectorAll<HTMLInputElement>('.market-field input').forEach(input => input.addEventListener('input', updatePreview));
  document.querySelector('#refresh')?.addEventListener('click', () => void loadData().catch(error => announce(error instanceof Error ? error.message : 'Market refresh failed.', 'bad')));
  document.querySelector('#create-order')?.addEventListener('click', () => {
    const units = Number(document.querySelector<HTMLInputElement>('#listing-units')?.value);
    const price = Number(document.querySelector<HTMLInputElement>('#listing-price')?.value);
    if (!Number.isInteger(units) || units < 1 || !Number.isInteger(price) || price < 1) { announce('Enter a whole-unit quantity and whole-credit price.', 'bad'); return; }
    if (side === 'sell' && units > inventoryFor(currentOre)) { announce('That is more ore than your vault has available.', 'bad'); return; }
    openConfirmation({
      title: `${side === 'sell' ? 'Sell' : 'Buy'} ${units} ${oreInfo(currentOre)[1]}?`,
      body: side === 'sell'
        ? `Post ${units} ${oreInfo(currentOre)[1]} at ${money(price)} test credits per unit. Ore will be reserved. You receive credits only when another player fills the order.`
        : `Post a buy order for ${units} ${oreInfo(currentOre)[1]} at ${money(price)} test credits per unit. ${money(units * price)} test credits will be reserved now.`,
      run: async () => {
        await api('rpc/market_create_listing', { method: 'POST', body: JSON.stringify({ p_side: side, p_ore: currentOre, p_units: units, p_unit_price: price }) });
        notice = 'Order posted. Your reserved balance is protected until it fills or you cancel.'; noticeKind = 'good'; await loadData();
      },
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-fill]').forEach(button => button.addEventListener('click', () => {
    const listing = listings.find(item => item.id === button.dataset.fill);
    const units = Number(document.querySelector<HTMLInputElement>(`#fill-${CSS.escape(button.dataset.fill!)}`)?.value);
    if (!listing || !Number.isInteger(units) || units < 1 || units > listing.remaining_units) { announce('Order quantity changed. Refresh before trying again.', 'bad'); return; }
    const total = units * listing.unit_price;
    if (listing.side === 'sell' && total > wallet.available_credits) { announce('Not enough available test credits for this fill.', 'bad'); return; }
    if (listing.side === 'buy' && units > inventoryFor(currentOre)) { announce(`Not enough available ${oreInfo(currentOre)[1]} to fill this order.`, 'bad'); return; }
    openConfirmation({
      title: `${listing.side === 'sell' ? 'Buy' : 'Sell'} ${units} ${oreInfo(currentOre)[1]}?`,
      body: `${listing.side === 'sell' ? 'Spend' : 'Receive'} ${money(total)} test credits for ${units} ${oreInfo(currentOre)[1]}. The database checks current balances and available quantity and settles this fill atomically.`,
      run: async () => { await api('rpc/market_fill_listing', { method: 'POST', body: JSON.stringify({ p_listing_id: listing.id, p_units: units }) }); notice = 'Trade settled.'; noticeKind = 'good'; await loadData(); },
    });
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach(button => button.addEventListener('click', () => {
    const listing = listings.find(item => item.id === button.dataset.cancel);
    if (!listing) return;
    openConfirmation({
      title: 'Cancel this open order?',
      body: `Cancel the remaining ${listing.remaining_units} ${oreInfo(listing.ore)[1]}. The unfilled ore or credits return to your available market vault.`,
      run: async () => { await api('rpc/market_cancel_listing', { method: 'POST', body: JSON.stringify({ p_listing_id: listing.id }) }); notice = 'Order cancelled; remaining assets are available again.'; noticeKind = 'good'; await loadData(); },
    });
  }));
  document.querySelector('#confirm-cancel')?.addEventListener('click', () => { pending = undefined; render(); });
  document.querySelector('#confirm-submit')?.addEventListener('click', async () => {
    const action = pending;
    if (!action) return;
    pending = undefined; render();
    try { await action.run(); }
    catch (error) { announce(error instanceof Error ? error.message : 'The order was not settled.', 'bad'); }
  });
}

async function start() {
  readSession();
  if (!configured || !session) { render(); return; }
  render();
  try {
    await loadData();
    refreshTimer = window.setInterval(() => void loadData().catch(() => { notice = 'Connection paused · tap refresh to retry.'; noticeKind = 'bad'; render(); }), 15_000);
  } catch (error) {
    if (!session) { render(); return; }
    announce(error instanceof Error ? error.message : 'Could not connect to market.', 'bad');
    if (session) refreshTimer = window.setInterval(() => void loadData().catch(() => {}), 15_000);
  }
}

void start();

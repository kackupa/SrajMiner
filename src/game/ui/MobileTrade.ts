/** Keep phone trading focused on the customer, carried ore and shipment. */
export function mobileTrade() {
  if (!matchMedia('(any-pointer: coarse)').matches) return;
  const root = document.querySelector<HTMLElement>('.trade-terminal');
  if (!root) return;
  const tabs = root.querySelector<HTMLElement>('.buyer-tabs')!;
  const label = document.createElement('label');
  label.className = 'mobile-buyer';
  label.textContent = 'Sell to';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Shipment customer');
  tabs.querySelectorAll<HTMLButtonElement>('[data-buyer]').forEach(button => {
    const option = document.createElement('option');
    option.value = button.dataset.buyer!;
    option.textContent = button.querySelector('span')?.firstChild?.textContent ?? button.textContent;
    option.selected = button.getAttribute('aria-pressed') === 'true';
    select.append(option);
  });
  select.onchange = () => tabs.querySelector<HTMLButtonElement>('[data-buyer="' + select.value + '"]')?.click();
  label.append(select);
  tabs.before(label);
  tabs.hidden = true;
  const reserve = root.querySelector('.build-reserve');
  if (reserve) {
    const details = document.createElement('details');
    details.className = 'mobile-reserve';
    const summary = document.createElement('summary');
    summary.textContent = 'Reserve materials for a building';
    details.append(summary);
    reserve.before(details);
    details.append(reserve);
  }
  let visible = 0;
  root.querySelectorAll<HTMLElement>('.manifest-line').forEach(row => {
    const totals = Array.from(row.querySelectorAll('div > b')).map(el => Number(el.textContent));
    row.hidden = totals.every(n => !n);
    if (!row.hidden) visible++;
    const input = row.querySelector<HTMLInputElement>('input')!;
    const max = document.createElement('button');
    max.textContent = 'Max';
    max.setAttribute('aria-label', 'Select all carried ' + input.dataset.shipment);
    max.disabled = Number(input.max) <= 0;
    max.onclick = () => { input.value = input.max; input.dispatchEvent(new Event('input', { bubbles: true })); };
    input.after(max);
  });
  if (!visible) {
    const empty = document.createElement('p');
    empty.textContent = 'No ore to sell. Return to mine, collect ore, then bring it back here.';
    root.querySelector('.manifest-table')!.before(empty);
  }
}

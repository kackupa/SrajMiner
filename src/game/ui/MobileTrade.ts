/** Keep phone trading focused on the customer, carried ore and shipment. */
export function mobileTrade() {
  if (!matchMedia('(any-pointer: coarse)').matches) return;
  const root = document.querySelector<HTMLElement>('.trade-terminal');
  if (!root) return;
  const tabs = root.querySelector<HTMLElement>('.buyer-tabs')!;
  tabs.classList.add('mobile-buyer-cards');
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

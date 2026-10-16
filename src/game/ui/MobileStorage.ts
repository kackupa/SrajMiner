import { ORE_KEYS, ORES, type Ore } from '../config';

/** Expand one ore at a time on phones; use the same transaction controls as desktop. */
export function mobileStorage(selected: Ore | undefined, select: (ore: Ore | undefined) => void) {
  if (!matchMedia('(any-pointer: coarse)').matches) return;
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.warehouse-ore-row'));
  const expand = (ore: Ore | undefined) => {
    select(ore);
    for (const [index, row] of rows.entries()) {
      const open = ORE_KEYS[index] === ore;
      row.classList.toggle('storage-expanded', open);
      row.querySelector('button.storage-toggle')?.setAttribute('aria-expanded', String(open));
      row.querySelectorAll<HTMLElement>('.warehouse-row-amount, .warehouse-row-actions, .storage-presets').forEach(el => { el.hidden = !open; });
    }
  };
  for (const [index, row] of rows.entries()) {
    const ore = ORE_KEYS[index];
    row.classList.add('mobile-storage-row');
    const name = row.querySelector('span')!;
    const toggle = document.createElement('button');
    toggle.className = 'storage-toggle';
    toggle.id = 'storage-open-' + ore;
    toggle.setAttribute('aria-label', 'Manage ' + ORES[ore].name);
    toggle.innerHTML = name.innerHTML + '<span aria-hidden="true">⌄</span>';
    name.replaceWith(toggle);
    toggle.onclick = () => expand(toggle.getAttribute('aria-expanded') === 'true' ? undefined : ore);
    const presets = document.createElement('div');
    presets.className = 'storage-presets';
    presets.setAttribute('aria-label', ORES[ore].name + ' amount presets');
    for (const amount of [0.5, 1, 5]) {
      const button = document.createElement('button');
      button.textContent = String(amount);
      button.setAttribute('aria-label', 'Set ' + ORES[ore].name + ' amount to ' + amount);
      button.onclick = () => {
        const input = row.querySelector('input')!;
        input.value = String(amount);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      presets.append(button);
    }
    row.querySelector('.warehouse-row-amount')!.after(presets);
    const discard = row.querySelector<HTMLButtonElement>('.discard-ore');
    if (discard) discard.textContent = 'Discard from miner';
  }
  expand(selected);
}

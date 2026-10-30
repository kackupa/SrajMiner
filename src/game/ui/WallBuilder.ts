import { UNDERGROUND_BUILDING } from '../config';
/** A shared mouse/touch toolbar. Placement state remains owned by the scene. */
export class WallBuilder {
  readonly root = document.createElement('section');
  private signature = '';
  constructor(actions: Record<string, () => void>) {
    this.root.className = 'wall-builder';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Wall stacking tools');
    this.root.innerHTML = `<div class="wall-builder-heading"><b>WALL BUILDER</b><output id="wall-layer"></output><span id="wall-budget"></span></div>
      <div class="wall-builder-actions"><button data-wall="lower" aria-label="Lower wall layer">− Layer</button><button data-wall="raise" aria-label="Raise wall layer">+ Layer</button><button data-wall="auto" aria-pressed="true">Auto-stack</button><button data-wall="place">Build block</button><button data-wall="done">Done</button></div>
      <small id="wall-build-hint"></small>`;
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-wall]');
      if (button && !button.disabled) actions[button.dataset.wall!]?.();
    });
    document.getElementById('viewport')!.append(this.root);
  }
  update(active: boolean, layer = 1, auto = true, count = 0, valid = false, hint = '') {
    this.root.hidden = !active;
    const signature = [layer, auto, count, valid, hint].join('|');
    if (!active || signature === this.signature) return;
    this.signature = signature;
    this.root.querySelector('#wall-layer')!.textContent = `LAYER ${layer}`;
    this.root.querySelector('#wall-budget')!.textContent = `${count} blocks built · ₭${UNDERGROUND_BUILDING.wall.credits} + ${UNDERGROUND_BUILDING.wall.materials.copper} copper each`;
    this.root.querySelector('[data-wall="auto"]')!.setAttribute('aria-pressed', String(auto));
    this.root.querySelector<HTMLButtonElement>('[data-wall="lower"]')!.disabled = layer <= 1;
    this.root.querySelector<HTMLButtonElement>('[data-wall="place"]')!.disabled = !valid;
    this.root.querySelector('#wall-build-hint')!.textContent = hint;
  }
  destroy() { this.root.remove(); }
}

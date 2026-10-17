/** Shared placement controls for mouse, keyboard and touch. */
export class PlacementControls {
 readonly root = document.createElement('nav');
 constructor(actions: { snap: () => void; place: () => void; cancel: () => void; left: () => void; right: () => void }) {
  this.root.className = 'placement-controls'; this.root.hidden = true; this.root.setAttribute('aria-label', 'Building placement');
  this.root.innerHTML = '<span>Choose a clear surface site</span><button data-place="left" aria-label="Move building left">Left</button><button data-place="right" aria-label="Move building right">Right</button><button data-place="snap" aria-pressed="false">Snap: off</button><button data-place="place">Place building</button><button data-place="cancel">Cancel</button>';
  this.root.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-place]'); if(b && !b.disabled) actions[b.dataset.place as keyof typeof actions](); });
  document.querySelector('#viewport')!.append(this.root);
 }
 update(active: boolean, snap: boolean, valid: boolean, reason = '') {
  this.root.hidden = !active; if (!active) return;
  const button = this.root.querySelector<HTMLButtonElement>('[data-place=snap]')!;
  button.textContent = snap ? 'Snap: on' : 'Snap: off'; button.setAttribute('aria-pressed', String(snap));
  this.root.querySelector<HTMLButtonElement>('[data-place=place]')!.disabled = !valid;
  this.root.querySelector('span')!.textContent = reason || (valid ? 'Site clear · Ready to build' : 'Choose a clear site');
 }
 destroy() { this.root.remove(); }
}

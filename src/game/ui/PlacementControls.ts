/** Shared placement controls for mouse, keyboard and touch. */
export class PlacementControls {
 readonly root = document.createElement('nav');
 constructor(actions: { snap: () => void; place: () => void; cancel: () => void; left: () => void; right: () => void }) {
  this.root.className = 'placement-controls'; this.root.hidden = true; this.root.setAttribute('aria-label', 'Building placement');
  this.root.innerHTML = '<span>Tap a spot. Drag to look around.</span><button data-place="left" aria-label="Move building left">←</button><button data-place="right" aria-label="Move building right">→</button><button data-place="place">Build here</button><button data-place="cancel">Done</button>';
  this.root.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-place]'); if(b && !b.disabled) actions[b.dataset.place as keyof typeof actions](); });
  document.querySelector('#viewport')!.append(this.root);
 }
 update(active: boolean, snap: boolean, valid: boolean, reason = '') {
  this.root.hidden = !active; if (!active) return;
  this.root.querySelector<HTMLButtonElement>('[data-place=place]')!.disabled = !valid;
  this.root.querySelector('span')!.textContent = reason || (valid ? 'Ready! Build here, then place another.' : 'Choose a clear site');
 }
 destroy() { this.root.remove(); }
}

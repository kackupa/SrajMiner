/** Shared button presentation for game UI, including panels created after launch.
 * Layout stays with the screen. New buttons may declare data-button="primary|secondary|danger|choice".
 * Existing selectors below are a compatibility bridge, not text-based role guessing.
 */
export function installGameButtons(root: HTMLElement) {
 const primary='.primary, #launch, #service-fuel, #service-hull, #freight-transfer, [data-simple-action="sell"], [data-place="place"], [data-wall="place"], #quick-unload, #quick-sell, #quick-repair, #quick-building-repair, .camp-full-services';
 const danger='.danger, #confirm-new, #colony-confirm, #confirm-warehouse-discard, #discard-confirm';
 const choice='[aria-pressed], [aria-current], .hub-grid button, [data-build-choice], [data-colony-select]';
 function decorate(button: HTMLButtonElement) {
  // These are spatial objects / telemetry, not conventional action buttons.
  if(button.matches('.star-world, .star-exchange, #open-cargo'))return;
  button.classList.add('game-button');
  if(!button.dataset.button)button.dataset.button=button.matches(danger)?'danger':button.matches(primary)?'primary':button.matches(choice)?'choice':'secondary';
 }
 function scan(node: Node) {
  if(!(node instanceof Element))return;
  if(node instanceof HTMLButtonElement)decorate(node);
  node.querySelectorAll<HTMLButtonElement>('button').forEach(decorate);
 }
 scan(root);
 const observer=new MutationObserver(records=>{for(const record of records)record.addedNodes.forEach(scan);});
 observer.observe(root,{childList:true,subtree:true});
 return ()=>observer.disconnect();
}


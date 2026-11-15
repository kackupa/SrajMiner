/** Opt-in art study. No campaign data is read or written in this mode. */
export const visualStudy =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('art-test') === '1';
export let revisedArt = visualStudy;
export let surfaceStepStudy = visualStudy;
export const combatStudy = visualStudy && new URLSearchParams(window.location.search).get('combat-test') === '1';
export function installStudyControls() {
  if (!visualStudy) return;
  const panel = document.createElement('aside');
  panel.className = 'art-study-controls';
  panel.innerHTML =
    `<span>TEMPORARY SAVE · ${combatStudy?'ARMED EXPEDITION · CAVES EAST OF THE SHIP':'WALK LEFT TO TEST HILLS'}</span><button type="button" aria-pressed="true">New art</button><button type="button" data-step-test aria-pressed="true">Step assist: On</button><button type="button" data-survey>Planet view</button><a href="game.html?art-test=1${combatStudy?'':'&combat-test=1'}">${combatStudy?'Art test':'Combat run'}</a><a href="game.html">Exit test</a>`;
  const button = panel.querySelector('button')!;
  button.addEventListener('click', () => {
    revisedArt = !revisedArt;
    button.textContent = revisedArt ? 'New art' : 'Original art';
    button.setAttribute('aria-pressed', String(revisedArt));
  });
  document.body.append(panel);
  document.body.classList.add('visual-study');
  panel.querySelector('[data-survey]')!.addEventListener('click',()=>window.dispatchEvent(new Event('study-survey')));
  if(combatStudy) panel.querySelector<HTMLElement>('[data-step-test]')!.hidden=true;
  const stepButton = panel.querySelector<HTMLButtonElement>('[data-step-test]')!;
  stepButton.addEventListener('click', () => {
    surfaceStepStudy = !surfaceStepStudy;
    stepButton.textContent = `Step assist: ${surfaceStepStudy ? 'On' : 'Off'}`;
    stepButton.setAttribute('aria-pressed', String(surfaceStepStudy));
  });
  // Account imports operate on the real Local campaign. They are deliberately
  // unavailable in a throwaway study, even if this browser is signed in.
  document.addEventListener(
    'click',
    (event) => {
      const target = (event.target as Element).closest('button,a');
      if (target && /account|online|backup/i.test(target.id)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}

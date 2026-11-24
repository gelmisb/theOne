// Which effect the homepage intro runs on top of its static photo. One switch, so changing
// your mind is a one-word edit:
//   'lens'  - a draggable lens of liquid glass (scripts/introLens.ts). Refracts only in Chromium
//             browsers; elsewhere the photo stays plain.
//   'cubes' - the photo as a field of isometric tiles that ripple under a finger (scripts/cubesBackground.ts).
//             Works in every browser with WebGL2; phones/touch only unless CUBES_ON_DESKTOP is set.
//   'none'  - just the static photo.
import { initIntroLens, destroyLens } from './introLens';
import { initCubesBackground, destroyCubes } from './cubesBackground';

type IntroEffect = 'lens' | 'cubes' | 'none';
const INTRO_EFFECT: IntroEffect = 'lens';

export function initIntroEffect() {
  destroyLens();
  destroyCubes();
  if (INTRO_EFFECT === 'lens') initIntroLens();
  else if (INTRO_EFFECT === 'cubes') initCubesBackground();
}

import Phaser from 'phaser';
import { backdropArtFile, faceArtFile, frameArtFile, nameplateArtFile, symbolArtFile } from '../rules/godArt';
import type { DeityCardState, God, Rank } from '../rules/types';
import type { CardDimensions } from './cardComponent';
import { PIXEL_RATIO } from '../render/pixelRatio';

// Real card compositing per the approved runtime-composited three-state
// card system (Numbered / Dormant / Powered). All masters are authored on a
// shared 1024x1536 reference canvas (see frameSize() below - also
// tune.json's cardStandard/cardMini width:height ratio, a clean 2:3) and
// scaled uniformly to the caller's live display size, so this one function
// works unchanged for hand-fan cards, played-card recesses, and any other
// consumer of buildCard() via cardComponent.ts's drawCard().
//
// Back-to-front layer order per state (see this task's handoff for the
// full placement table):
//   Numbered (rank 2-10): backdrop -> Deity Symbol (large) -> frame -> rank
//   Dormant  (DeityCard, not powered): backdrop -> Deity Symbol (extra-large)
//     -> frame -> nameplate -> "1"
//   Powered  (DeityCard, powered): backdrop -> Deity Face (anime art) ->
//     frame -> Deity Symbol (small top badge, ABOVE the frame) -> nameplate
//     -> "★"
// The frame is always drawn on top of the main symbol/face layer so its
// opaque border masks any layer that intentionally overflows the window
// (e.g. Dormant's 1130px-wide symbol box on the 1024px-wide canvas) -
// except Powered's small top-badge symbol, which the approved spec
// explicitly places above the frame and must never be masked by it.
// Rank numerals and the star are live Phaser.Text (per root CLAUDE.md's DPR
// rule), never baked into art. Deity names are the approved nameplate PNGs,
// never recreated as text.

function symbolKey(god: God): string {
  return symbolArtFile(god);
}

function faceKey(god: God): string {
  return faceArtFile(god);
}

function frameKey(god: God): string {
  return frameArtFile(god);
}

function backdropKey(god: God): string {
  return backdropArtFile(god);
}

function nameplateKey(god: God): string {
  return nameplateArtFile(god);
}

// Loads the R2-fetched loose PNGs (see art/manifest.json, produced by
// scripts/pack-assets.js from prototypes/suits-mp/assets-src/loose/) the
// same manifest-driven way every other prototype with loose art loads it
// (see prototypes/digger/src/main.ts's preload) - discovering filenames
// from the manifest rather than hardcoding them keeps this working if art
// gets re-exported under different filenames later.
interface ManifestEntry {
  path: string;
  hash: string;
  fetchedAt: string;
}

const MANIFEST_KEY = '__suitsMpCardArtManifest';

function queueLooseImages(scene: Phaser.Scene): void {
  const manifest = scene.cache.json.get(MANIFEST_KEY) as ManifestEntry[];
  for (const entry of manifest) {
    if (!entry.path.startsWith('loose/')) continue;
    const key = entry.path.slice('loose/'.length).replace(/\.[^.]+$/, '');
    if (!scene.textures.exists(key)) scene.load.image(key, `assets/${entry.path}`);
  }
}

export function preloadCardArt(scene: Phaser.Scene): void {
  if (scene.cache.json.exists(MANIFEST_KEY)) {
    // A previous scene instance in this same Game already loaded the
    // manifest (and, via the completion handler below, the images it
    // lists) - re-queuing loads for keys that already exist in the
    // Texture Manager is a no-op per queueLooseImages' own guard, so this
    // only matters the first time any scene reaches here.
    queueLooseImages(scene);
    return;
  }
  scene.load.json(MANIFEST_KEY, 'assets/manifest.json');
  scene.load.once(`filecomplete-json-${MANIFEST_KEY}`, () => queueLooseImages(scene));
}

// --- Reference-canvas placement, per the approved handoff's placement table
// (all masters authored at 1024x1536; every box below is given as absolute
// reference-canvas pixels, top-left + size, and every art layer is "contain"
// fit - aspect preserved, centered on both axes - within its box).

function frameSize(): { w: number; h: number } {
  return { w: 1024, h: 1536 };
}

interface RefBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Numbered symbol: contain within 760x760, horizontally centered, top y=290.
const NUMBERED_SYMBOL_BOX: RefBox = { x: 132, y: 290, w: 760, h: 760 };

// Dormant symbol: contain within 1130x1130, horizontally centered, top
// y=170. Wider than the 1024px canvas by design (the source plate's own
// padding allows a nearly full-width visible symbol) - the box legitimately
// extends past the canvas's left/right edges; the frame drawn on top masks
// the overflow.
const DORMANT_SYMBOL_BOX: RefBox = { x: -53, y: 170, w: 1130, h: 1130 };

// Powered anime Deity: contain within 850x1190, horizontally centered, top
// y=180.
const POWERED_FACE_BOX: RefBox = { x: 87, y: 180, w: 850, h: 1190 };

// Powered top symbol: contain within 400x400, horizontally centered, top
// y=-40 (extends above the canvas top by design) - rendered above the
// frame, never masked beneath it.
const POWERED_TOP_SYMBOL_BOX: RefBox = { x: 312, y: -40, w: 400, h: 400 };

// Deity nameplate: contain within 680x170, horizontally centered, top
// y=1330 (visible bottom edge flush with the bottom frame).
const NAMEPLATE_BOX: RefBox = { x: 172, y: 1330, w: 680, h: 170 };

// Runtime rank/state glyph: centered on (220, 1308), in the frame's
// integrated lower-left rank quadrant. Numeral ~158px tall, star ~176px,
// both on the 1024x1536 reference canvas.
const RUNTIME_RANK_CENTER = { x: 220, y: 1308 };
const RUNTIME_NUMERAL_SIZE = 158;
const RUNTIME_STAR_SIZE = 176;

type CardVisualState = 'numbered' | 'dormant' | 'powered';

// The exact existing state-determination logic (unchanged from before this
// task): a face-up Deity Card is Powered only when its resolved
// deityCardState is 'powered'; null (never resolved - still sitting in a
// hand, or any face-up card that isn't a Deity Card at all) and 'dormant'
// are both Dormant. A non-DeityCard rank (2-10) is always Numbered. This is
// a pure re-expression of the prior windowArtKey/badgeMarkerText branching
// under the new three-state naming, not a reinterpretation of game rules.
function cardVisualState(rank: Rank, deityCardState: DeityCardState | null): CardVisualState {
  if (rank !== 'DeityCard') return 'numbered';
  return deityCardState === 'powered' ? 'powered' : 'dormant';
}

// The rank quadrant's runtime glyph: the plain rank for a Numbered card, or
// the Dormant/Powered state marker for a Deity Card - never the god's name,
// which is shown via the nameplate art instead and never changes between
// states.
function rankGlyphText(rank: Rank, state: CardVisualState): string {
  if (state === 'numbered') return String(rank);
  return state === 'powered' ? '★' : '1';
}

// Adds `textureKey` to `container`, contain-fit (aspect preserved, centered
// on both axes) within `box` (given in reference-canvas pixels), scaled by
// `k` into the caller's live display size. Silently skipped if the texture
// isn't loaded, matching the rest of this module's defensive art lookups.
function placeContain(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  textureKey: string,
  box: RefBox,
  k: number,
  authW: number,
  authH: number,
): void {
  if (!scene.textures.exists(textureKey)) return;
  const image = scene.add.image(0, 0, textureKey);
  const srcFrame = image.frame;
  const boxW = box.w * k;
  const boxH = box.h * k;
  const fitScale = Math.min(boxW / srcFrame.width, boxH / srcFrame.height);
  image.setDisplaySize(srcFrame.width * fitScale, srcFrame.height * fitScale);
  image.setX((box.x + box.w / 2 - authW / 2) * k);
  image.setY((box.y + box.h / 2 - authH / 2) * k);
  container.add(image);
}

export interface BuiltCard {
  container: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Rectangle;
}

// The one place a real (non-facedown, non-empty) card gets assembled -
// backdrop + symbol/face + frame + (Powered's top symbol) + nameplate +
// rank/state glyph - reusable wherever a face-up card appears (hand fan,
// play areas, previous-trick log). `dims` is the caller's display size in
// logical px; art is always authored at the fixed 1024x1536 reference and
// scaled uniformly to fit, so this works at both CARD_DIMS_STANDARD and
// CARD_DIMS_MINI (and the hand fan's popped-out scale) without regenerating
// any texture.
export function buildCard(
  scene: Phaser.Scene,
  god: God,
  rank: Rank,
  dims: CardDimensions,
  deityCardState: DeityCardState | null = null,
): BuiltCard {
  const { w: authW, h: authH } = frameSize();
  const k = dims.width / authW;

  const container = scene.add.container(0, 0);

  // 1. Backdrop - full canvas, always the back-most layer. Its own alpha
  //    already keeps it inside the frame's silhouette (see this task's
  //    BUILD_STATUS.md) - never given an opaque rectangular container.
  if (scene.textures.exists(backdropKey(god))) {
    container.add(scene.add.image(0, 0, backdropKey(god)).setDisplaySize(dims.width, dims.height));
  }

  const state = cardVisualState(rank, deityCardState);

  // 2. Main symbol/face layer, BEFORE the frame (see module header comment
  //    on masking).
  if (state === 'powered') {
    placeContain(scene, container, faceKey(god), POWERED_FACE_BOX, k, authW, authH);
  } else if (state === 'dormant') {
    placeContain(scene, container, symbolKey(god), DORMANT_SYMBOL_BOX, k, authW, authH);
  } else {
    placeContain(scene, container, symbolKey(god), NUMBERED_SYMBOL_BOX, k, authW, authH);
  }

  // 3. Frame - full canvas, on top of the backdrop and main symbol/face
  //    layer.
  container.add(scene.add.image(0, 0, frameKey(god)).setDisplaySize(dims.width, dims.height));

  // 4. Powered's small top-badge symbol - the one art layer that renders
  //    ABOVE the frame, per the approved spec, so it is never masked.
  if (state === 'powered') {
    placeContain(scene, container, symbolKey(god), POWERED_TOP_SYMBOL_BOX, k, authW, authH);
  }

  // 5. Nameplate - Dormant and Powered only; a Numbered 2-10 card never
  //    gets one.
  if (state === 'dormant' || state === 'powered') {
    placeContain(scene, container, nameplateKey(god), NAMEPLATE_BOX, k, authW, authH);
  }

  // 6. Runtime rank/state glyph - always topmost, live text per the DPR
  //    rule (root CLAUDE.md), never baked into any PNG.
  const glyph = rankGlyphText(rank, state);
  const glyphRefSize = glyph === '★' ? RUNTIME_STAR_SIZE : RUNTIME_NUMERAL_SIZE;
  const glyphFontSize = glyphRefSize * k;
  const glyphX = (RUNTIME_RANK_CENTER.x - authW / 2) * k;
  const glyphY = (RUNTIME_RANK_CENTER.y - authH / 2) * k;
  const glyphText = scene.add
    .text(glyphX, glyphY, glyph, {
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      fontSize: `${Math.round(glyphFontSize)}px`,
      color: '#fff6df',
      stroke: '#1a0f04',
      strokeThickness: Math.max(2, Math.round(glyphFontSize * 0.12)),
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);
  container.add(glyphText);

  const hitArea = scene.add.rectangle(0, 0, dims.width, dims.height, 0x000000, 0.001);
  container.add(hitArea);

  return { container, hitArea };
}

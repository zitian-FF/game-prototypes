import Phaser from 'phaser';
import { backdropArtFile, faceArtFile, frameArtFile, nameplateArtFile, symbolArtFile } from '../rules/godArt';
import type { DeityCardState, God, Rank } from '../rules/types';
import type { CardDimensions } from './cardComponent';
import { PIXEL_RATIO } from '../render/pixelRatio';
import tune from '../../tune.json';

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
//   Numbered (rank 2-10): backdrop -> Deity Symbol -> frame -> rank
//   Dormant  (DeityCard, not powered): backdrop -> Deity Symbol -> frame ->
//     nameplate -> "1"
//   Powered  (DeityCard, powered): backdrop -> Deity Face (anime art) ->
//     frame -> Deity Symbol (small top badge, ABOVE the frame) -> nameplate
//     -> "★"
// The frame is always drawn on top of the main symbol/face layer so its
// opaque border masks any layer that intentionally overflows the window
// (e.g. the symbol box's 1130px width on the 1024px-wide canvas) - except
// Powered's small top-badge symbol, which the approved spec explicitly
// places above the frame and must never be masked by it.
// Rank numerals and the star are live Phaser.Text (per root CLAUDE.md's DPR
// rule), never baked into art. Deity names are the approved nameplate PNGs,
// never recreated as text.
//
// DEVIATION FROM THE ORIGINAL APPROVED HANDOFF: that spec sized Numbered's
// symbol smaller (contain within 760x760, top y=290) than Dormant's
// (1130x1130, top y=170) to visually flag the Deity Card's special status.
// Judged incorrect after seeing it live - Numbered now uses the exact same
// box as Dormant (see SYMBOL_BOX below). Flagging here for GPT/Codex to
// reconcile back into suits-mp-screen-reference.md; the Numbered-specific
// 760x760/y=290 box no longer exists in code.

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

// Deity Symbol box, shared by Numbered and Dormant alike (see this file's
// header comment on the deviation from the original handoff, which sized
// these differently): contain within 1130x1130, horizontally centered, top
// y=170. Wider than the 1024px canvas by design (the source plate's own
// padding allows a nearly full-width visible symbol) - the box legitimately
// extends past the canvas's left/right edges; the frame drawn on top masks
// the overflow.
const SYMBOL_BOX: RefBox = { x: -53, y: 170, w: 1130, h: 1130 };

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
// `k` into the caller's live display size. Silently skipped (returns null)
// if the texture isn't loaded, matching the rest of this module's
// defensive art lookups. Returns the placed Image so a caller that needs
// to animate or mask it afterward (see playAwakenedEffect below) doesn't
// have to re-derive its position/size independently - buildCard's own call
// sites below simply ignore the return value, unchanged.
function placeContain(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  textureKey: string,
  box: RefBox,
  k: number,
  authW: number,
  authH: number,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(textureKey)) return null;
  const image = scene.add.image(0, 0, textureKey);
  const srcFrame = image.frame;
  const boxW = box.w * k;
  const boxH = box.h * k;
  const fitScale = Math.min(boxW / srcFrame.width, boxH / srcFrame.height);
  image.setDisplaySize(srcFrame.width * fitScale, srcFrame.height * fitScale);
  image.setX((box.x + box.w / 2 - authW / 2) * k);
  image.setY((box.y + box.h / 2 - authH / 2) * k);
  container.add(image);
  return image;
}

export interface BuiltCard {
  container: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Rectangle;
}

// Ongoing "foil card" idle shimmer: every Powered Deity Card shows this for
// as long as it keeps rendering Powered - wherever it's drawn (hand fan,
// play area, previous-trick log) - not just during the one-shot
// playAwakenedEffect reveal burst above (which still fires separately, only
// on the render where a card first becomes eligible/lands Powered). Same
// masked-to-the-art-silhouette approach as that burst (a BitmapMask
// referencing the card's own face image, so the color only ever shows
// through the painted Deity, never as a stray rectangle), but a
// continuously scrolling rainbow band strip instead of a single gradient
// that scales up and fades once - see addPoweredIdleShimmer's own body for
// why a repeating band strip, not one smooth gradient quad, is what
// actually reads clearly at hand-fan scale.
//
// Lifecycle/cleanup: this whole file has no persistent/incremental object
// reuse - every render pass wipes and rebuilds the entire canvas tree from
// scratch (renderGameView.ts's renderWithView calls `container.removeAll
// (true)` at the top of every single pass, including ones triggered by a
// mere hover/selection change, not just a real game-state update). Without
// explicit cleanup, this looping tween would keep running forever against
// an already-destroyed Graphics object - a real, accumulating leak given
// how often a render pass fires. Container.destroy() cascades to every
// descendant (Phaser containers default to `exclusive: true`), so this
// shimmer's own DESTROY event reliably fires the instant this card's
// container is torn down, on whichever render pass that happens to be -
// including the very next one, if the card stops rendering Powered at all
// (played, or the trick just ended and this Deity Card reverted to
// Dormant) - which is also exactly how this effect "stops when the trick
// is over": it's never drawn as anything but a plain static swap once
// `deityCardState` is no longer 'powered', so nothing further is needed
// to enforce that boundary here.
function addPoweredIdleShimmer(scene: Phaser.Scene, container: Phaser.GameObjects.Container, faceImage: Phaser.GameObjects.Image): void {
  // BitmapMask is WebGL-only (a no-op/unmasked in the Canvas renderer
  // fallback) - skipped outright there, matching playAwakenedEffect's own
  // identical guard, rather than risk an unmasked rainbow rectangle
  // floating free of the art.
  if (scene.renderer.type !== Phaser.WEBGL) return;

  // NORMAL alpha blend, not ADD: additive light only brightens a pixel, so
  // against pale/light card art (this washes out toward white - barely
  // visible, the opposite of "obvious") it has little headroom left to
  // add. Plain alpha-blended color shows the same rainbow hue clearly
  // against any underlying brightness, dark or light.
  //
  // A repeating band strip, not one big 4-corner gradient: a single smooth
  // gradient spread across a quad much larger than the card (needed so a
  // rotating/sweeping quad never exposes a gap) puts the visible window
  // near the gradient's own middle, where all 4 corner colors blend toward
  // a similar in-between average - the card ends up seeing barely any hue
  // change no matter how the quad moves. Explicit repeating bands, each
  // sized as a fraction of the card's own width, guarantee real color
  // *contrast* is always visible within the card itself, not just
  // somewhere on a much bigger shape most of which the card never shows.
  const bandColors = [0xff5ecb, 0xffe45e, 0x5ecbff, 0xa25eff];
  const bandWidth = faceImage.displayWidth * 0.5;
  const cycleWidth = bandWidth * bandColors.length;
  const totalBands = bandColors.length * 3; // enough strip length either side of center to stay covered through one full loop
  const shimmer = scene.add.graphics();
  for (let i = 0; i < totalBands; i++) {
    shimmer.fillStyle(bandColors[i % bandColors.length], 1);
    shimmer.fillRect(i * bandWidth - (totalBands * bandWidth) / 2, (-faceImage.displayHeight * 1.3) / 2, bandWidth, faceImage.displayHeight * 1.3);
  }
  shimmer.setRotation(Math.PI / 6);
  shimmer.setPosition(faceImage.x, faceImage.y);
  shimmer.setAlpha(tune.awakenedIdleShimmerAlpha);
  shimmer.setMask(new Phaser.Display.Masks.BitmapMask(scene, faceImage));
  container.add(shimmer);

  // Translating by exactly one full color-cycle (cycleWidth) makes the
  // pattern tile seamlessly, so `repeat: -1` (no yoyo) loops with no
  // visible snap - reads as an endlessly scrolling rainbow, not a sweep
  // that pauses and reverses.
  const tween = scene.tweens.add({
    targets: shimmer,
    x: faceImage.x - cycleWidth,
    duration: tune.awakenedIdleShimmerMs,
    ease: 'Linear',
    repeat: -1,
  });
  shimmer.once(Phaser.GameObjects.Events.DESTROY, () => tween.stop());
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
  //    on masking). Numbered and Dormant share the exact same symbol box -
  //    see this file's header comment on the deviation from the original
  //    handoff, which sized these differently.
  if (state === 'powered') {
    const faceImage = placeContain(scene, container, faceKey(god), POWERED_FACE_BOX, k, authW, authH);
    if (faceImage) addPoweredIdleShimmer(scene, container, faceImage);
  } else {
    placeContain(scene, container, symbolKey(god), SYMBOL_BOX, k, authW, authH);
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

// The "Awakened" reveal flourish: a duplicate deity-face + star burst that
// scales up to tune.awakenedBurstScale and fades out on top of a card
// whose real, static art has *already* swapped to (or already was)
// Powered - this never changes what's actually drawn underneath, it only
// adds a temporary, self-destroying celebration on top of it. Two callers,
// both in ui/renderGameView.ts:
//   - renderCardFan, the instant a Dormant Deity Card still sitting in the
//     local player's own hand becomes eligible to Awaken (any 10 appears
//     in the current trick) - fired together with that card's underlying
//     art actually swapping to Powered.
//   - animateCardPlayIntoPlayArea, after another player's already-Powered
//     play finishes landing in its play area - no underlying swap there,
//     since the local player never saw that card Dormant to begin with
//     (it was masked/hidden until played).
// `container` must be the exact same local coordinate space buildCard()
// placed its own layers into (card-center-relative, matching `dims`) -
// both callers pass the outer container drawCard() itself returned, which
// shares that origin with buildCard's inner one (see drawCard's own
// `card.add(built.container)`, added at (0,0)).
export function playAwakenedEffect(scene: Phaser.Scene, container: Phaser.GameObjects.Container, god: God, dims: CardDimensions): void {
  const { w: authW, h: authH } = frameSize();
  const k = dims.width / authW;

  const faceBurst = placeContain(scene, container, faceKey(god), POWERED_FACE_BOX, k, authW, authH);
  if (faceBurst) {
    scene.tweens.add({
      targets: faceBurst,
      scale: tune.awakenedBurstScale,
      alpha: 0,
      duration: tune.awakenedBurstMs,
      ease: tune.awakenedBurstEase,
      onComplete: () => faceBurst.destroy(),
    });

    // Rainbow holo-foil shimmer: a single additive-blended rainbow-gradient
    // quad, swept across the burst art once, masked to that same art's own
    // alpha silhouette (a live BitmapMask reference, not a hand-authored
    // shape) so the shine only ever shows through the Deity's actual
    // painted outline - never as a stray rectangle, and never needing a
    // second traced silhouette to stay in sync with the art. A tasteful
    // gradient sweep was judged the better effort/quality tradeoff over a
    // custom shader here - cheap (one Graphics quad + a stock Phaser mask)
    // and already reads as a foil-card shine; see BUILD_STATUS.md.
    // BitmapMask is WebGL-only (a no-op/unmasked in the Canvas renderer
    // fallback) - skipped outright there rather than risk an unmasked
    // rainbow rectangle floating free of the art.
    if (scene.renderer.type === Phaser.WEBGL) {
      const shimmer = scene.add.graphics();
      const shimmerW = faceBurst.displayWidth * 1.4;
      const shimmerH = faceBurst.displayHeight * 1.4;
      shimmer.fillGradientStyle(0xff5ecb, 0xffe45e, 0x5ecbff, 0xa25eff, 1, 1, 1, 1);
      shimmer.fillRect(-shimmerW / 2, -shimmerH / 2, shimmerW, shimmerH);
      shimmer.setRotation(Math.PI / 6);
      shimmer.setPosition(faceBurst.x - shimmerW * 0.6, faceBurst.y);
      shimmer.setBlendMode(Phaser.BlendModes.ADD);
      shimmer.setAlpha(tune.awakenedShimmerAlpha);
      shimmer.setMask(new Phaser.Display.Masks.BitmapMask(scene, faceBurst));
      container.add(shimmer);
      scene.tweens.add({
        targets: shimmer,
        x: faceBurst.x + shimmerW * 0.6,
        duration: tune.awakenedShimmerMs,
        ease: 'Sine.easeInOut',
        onComplete: () => shimmer.destroy(),
      });
    }
  }

  const starBurst = scene.add
    .text((RUNTIME_RANK_CENTER.x - authW / 2) * k, (RUNTIME_RANK_CENTER.y - authH / 2) * k, '★', {
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      fontSize: `${Math.round(RUNTIME_STAR_SIZE * k)}px`,
      color: '#fff6df',
      stroke: '#1a0f04',
      strokeThickness: Math.max(2, Math.round(RUNTIME_STAR_SIZE * k * 0.12)),
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);
  container.add(starBurst);
  scene.tweens.add({
    targets: starBurst,
    scale: tune.awakenedBurstScale,
    alpha: 0,
    duration: tune.awakenedBurstMs,
    ease: tune.awakenedBurstEase,
    onComplete: () => starBurst.destroy(),
  });
}

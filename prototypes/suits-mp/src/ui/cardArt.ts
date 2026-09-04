import Phaser from 'phaser';
import { GOD_TEAM } from '../rules/cards';
import { faceArtFile, frameArtFile, rankBadgeArtFile, symbolArtFile } from '../rules/godArt';
import type { DeityCardState, God, Rank } from '../rules/types';
import type { CardDimensions } from './cardComponent';
import { PIXEL_RATIO } from '../render/pixelRatio';

// Real card compositing from the baked art handoff (card_frame_<deity>.png,
// deity_symbol_<deity>.png, deity_face_<deity>.png, rank_badge_<team>.png -
// see the runtime asset manifest). Three layers, all real R2-fetched PNGs
// (no more Canvas2D-generated frame textures - the earlier CSS-recolorable
// token frame system, GOD_TOKENS/drawFrameTexture and everything under it,
// is removed entirely per this task's explicit resolution):
//   1. The god's own card_frame_<deity>.png as the full card background -
//      one real per-god frame image, already including the card's border,
//      ornamentation and a baked-in bottom-left circular badge socket.
//   2. The god's symbol or face art, placed in the frame's main window.
//      Numbered cards (2-10) and a Dormant Deity Card both show the Deity
//      Symbol; only a Powered Deity Card shows the Deity Face instead.
//   3. A small rank badge in the frame's own bottom-left socket -
//      rank_badge_chaos_portal.png/rank_badge_cosmos_galaxy.png by Team,
//      with a live Phaser.Text on top (per root CLAUDE.md's DPR rule): the
//      plain rank numeral for a numbered card, or the Dormant/Powered state
//      marker ("1"/"★") for a Deity Card. A Deity Card's *name* never
//      changes between states - only this marker, and the symbol/face
//      layer above, do.
//
// Every position/size below is measured directly off the real art (see
// this task's BUILD_STATUS.md) rather than transcribed from a design spec,
// since none was provided for the new images' internal layout.

function symbolKey(god: God): string {
  return symbolArtFile(god);
}

function faceKey(god: God): string {
  return faceArtFile(god);
}

function frameKey(god: God): string {
  return frameArtFile(god);
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

// --- Card-local layout, measured off the real card_frame_<deity>.png -----
// (1024x1536 native, a clean 2:3 aspect - tune.json's cardStandard/cardMini
// width:height ratios were updated to match, so cards are never stretched;
// see BUILD_STATUS.md for the measurement method: alpha-channel inspection
// of the frame art to find its window and its baked-in badge socket, since
// no pixel spec doc came with this handoff.)

// The frame's own main window (behind the Deity Symbol/Face), as fractions
// of the full card - a rounded-rect area below the frame's ornamental
// crown, above its bottom wave/badge-socket band.
const WINDOW = { x: 0.08, y: 0.155, w: 0.84, h: 0.6 };

// The frame's baked-in circular badge socket, bottom-left - center and
// diameter as fractions of the full card.
const BADGE_CENTER = { x: 0.145, y: 0.82 };
const BADGE_DIAMETER = 0.19;

function frameSize(): { w: number; h: number } {
  return { w: 1024, h: 1536 };
}

// The god's Deity Symbol for a numbered card or a Dormant Deity Card; its
// Deity Face once Powered. `deityCardState` is null for anything that
// isn't a face-up Deity Card (see cardComponent.ts's CardFace doc comment)
// and is treated the same as 'dormant' - a Deity Card always starts
// Dormant, and one still sitting unplayed in a hand has no real state yet.
function windowArtKey(god: God, rank: Rank, deityCardState: DeityCardState | null): string {
  const isPowered = rank === 'DeityCard' && deityCardState === 'powered';
  return isPowered ? faceKey(god) : symbolKey(god);
}

// The bottom-left badge's marker: the plain rank for a numbered card, or
// the Dormant/Powered state marker for a Deity Card - never the god's name,
// which never changes between states (see this module's header comment).
function badgeMarkerText(rank: Rank, deityCardState: DeityCardState | null): string {
  if (rank !== 'DeityCard') return String(rank);
  return deityCardState === 'powered' ? '★' : '1';
}

export interface BuiltCard {
  container: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Rectangle;
}

// The one place a real (non-facedown, non-empty) card gets assembled -
// frame + Deity Symbol/Face + rank/state badge - reusable wherever a
// face-up card appears (hand fan, play areas, previous-trick log). `dims`
// is the caller's display size in logical px; art is always authored/
// generated at the fixed 1024x1536 reference and scaled down to fit, so
// this works at both CARD_DIMS_STANDARD and CARD_DIMS_MINI (and the hand
// fan's popped-out scale) without regenerating any texture.
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

  const frame = scene.add.image(0, 0, frameKey(god)).setDisplaySize(dims.width, dims.height);
  container.add(frame);

  const artKey = windowArtKey(god, rank, deityCardState);
  if (scene.textures.exists(artKey)) {
    const art = scene.add.image(0, 0, artKey);
    const srcFrame = art.frame;
    const winW = WINDOW.w * authW * k;
    const winH = WINDOW.h * authH * k;
    const fitScale = Math.min(winW / srcFrame.width, winH / srcFrame.height);
    art.setDisplaySize(srcFrame.width * fitScale, srcFrame.height * fitScale);
    art.setX((WINDOW.x + WINDOW.w / 2 - 0.5) * authW * k);
    art.setY((WINDOW.y + WINDOW.h / 2 - 0.5) * authH * k);
    container.add(art);
  }

  const team = GOD_TEAM[god];
  const badgeKey = rankBadgeArtFile(team);
  const badgeCx = (BADGE_CENTER.x - 0.5) * authW * k;
  const badgeCy = (BADGE_CENTER.y - 0.5) * authH * k;
  const badgeDiameter = BADGE_DIAMETER * authW * k;
  if (scene.textures.exists(badgeKey)) {
    const badge = scene.add.image(badgeCx, badgeCy, badgeKey).setDisplaySize(badgeDiameter, badgeDiameter);
    container.add(badge);
  }

  const marker = badgeMarkerText(rank, deityCardState);
  const markerFontSize = Math.round(badgeDiameter * (marker.length > 1 ? 0.4 : 0.5));
  const markerText = scene.add
    .text(badgeCx, badgeCy, marker, {
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      fontSize: `${markerFontSize}px`,
      color: '#fff6df',
      stroke: '#1a0f04',
      strokeThickness: Math.max(2, Math.round(markerFontSize * 0.12)),
      resolution: PIXEL_RATIO,
    })
    .setOrigin(0.5);
  container.add(markerText);

  const hitArea = scene.add.rectangle(0, 0, dims.width, dims.height, 0x000000, 0.001);
  container.add(hitArea);

  return { container, hitArea };
}

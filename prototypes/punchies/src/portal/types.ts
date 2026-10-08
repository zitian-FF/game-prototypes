// Portal layer: one small interface between the game and whichever site hosts
// it (itch.io or a dev server, CrazyGames, Poki, Playgama). The game only talks
// to this interface; each site gets a thin adapter, chosen at build time.

export type RewardedResult = 'rewarded' | 'failed' | 'unavailable';

export interface RewardedHooks {
  /** Called when the ad really starts playing: mute and block input now. */
  onStart: () => void;
}

export interface PortalAds {
  /** False when this build has no ads at all (hide the ad button). */
  readonly available: boolean;
  /** 'preview' = no real ad is shown, the reward is granted straight away. */
  readonly kind: 'real' | 'preview';
  showRewarded(placement: string, hooks: RewardedHooks): Promise<RewardedResult>;
}

/** Synchronous key/value store with the same shape as localStorage. */
export interface PortalStorage {
  /** Load every registered key before the first scene reads one. */
  preload(keys: readonly string[]): Promise<void>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Portal {
  readonly id: 'web' | 'crazygames' | 'poki' | 'playgama';
  init(): Promise<void>;
  /** The first menu is up: the game has finished loading. */
  loadingFinished(): void;
  /** The player is (true) or is not (false) actively playing. Already de-duplicated. */
  gameplay(active: boolean): void;
  readonly ads: PortalAds;
  readonly storage: PortalStorage;
}

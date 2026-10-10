// Every persisted key, in one place. The portal preloads these before the first
// scene runs, so any new saved key must be added here (test-punchies-portal.mjs
// fails if a key is read from the store without being listed).
export const KEYS = {
  audio: 'punchies:audio:v1',
  shop: 'punchies:shop-preview:v1',
  tutorial: 'punchies:tutorial:v1',
  chars: 'punchies:chars:v1',
  localInputs: 'punchies:localInputs:v1',
  language: 'punchies:language:v1',
  firstRun: 'punchies:firstrun:v1',
  progress: 'punchies:progress:v1',
  profile: 'punchies:profile:v1',
  liveTranslations: 'punchies:translations-cache:v1',
} as const;

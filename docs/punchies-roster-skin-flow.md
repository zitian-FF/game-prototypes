# Highlighted fighter skin controls

Future batch separate from the current release. One confirmation commits the fighter and current skin; Logic owns navigation/confirmation/binding hints.

View: available highlighted fighter shows skin tray before confirmation. X/N and skin name remain visible on confirmed card, but arrows disable for locked/inactive sides, hidden/remote placeholders, dummy, survival opponent, or one owned skin. Focused/locked state participates in the cached render key to avoid stale touch actions.

Arrow targets48×40 logical pixels at centre±74 inside the198px-wide tray. Namefit88px leaves6px between name and arrows. Existing row/portrait/stat/backing/footer/action positions remain. Only fighter identity change triggers portrait slide; skin/selected/locked/focus updates preserve pose and do not replay clashes.

Focused animation fixture covers pre-confirm touch access, locked/inactive disable, rapid switching, skin/confirm no replay, persistent objects/text, reduced motion and listener cleanup; TypeScript and diff checks pass. Logic helper for skins footer hint pending; proposed4-column footer y334 centres258/368/478/588 cap100px within central gap. Physical touch/controller and combined-render checks belong Build.

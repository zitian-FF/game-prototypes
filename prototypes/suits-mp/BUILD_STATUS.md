## Current milestone

The host can display a quick-join QR code, and the game has basic sound cues with a persistent menu mute switch.

## What was implemented

- Added Show QR to the host lobby. The QR encodes the published itch.io game URL with the current three-character room code.
- Kept the existing invite-link startup path, which reads the room code and enters the joining flow after scanning.
- Added lightweight synthesized tap, card, action, and victory cues, plus Sound: On/Off in the game menu.

## Key technical decisions

- The QR is drawn from the already-installed qrcode package directly into Phaser graphics, with a white quiet zone; no image upload or additional download is required.
- Sound is generated through WebAudio after interaction and the preference is saved in localStorage. Unavailable audio or storage does not block gameplay.
- Typecheck and build passed. Host lobby, QR, and mute switch were inspected in the local browser; no browser errors were reported.

## Open questions

- None.

## Known issues

- The generated WebAudio cues are prototype sounds, pending final sound design.

## Next proposed step

- Review QR scanning and sound levels on the merged itch.io phone build.

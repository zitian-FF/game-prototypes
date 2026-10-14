# Canonical Punchies wordmark

`logo-master.png` is the definitive 2172x724 transparent master, repaired from
the original live logo under the owner's 2026-10-14 directive. It preserves the
cream/blue lettering, navy outline, gold crown and red extrusion, with continuous
fills. SHA-256: `ca2775d03c2405163970bd7d68d5f2c7ebafea37ff77cb720664a23661dae105`.

Runtime derivatives use uniform fitting, transparent padding and lossless WebP:

| Profile | File | Canvas | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| Standard | logo-standard.webp | 924x290 | 189056 | ec29006ecab069522f00ba3469e535a0ad8b8cc2bd0e6545ba1b251973cbb1d9 |
| Compact | logo-compact.webp | 462x145 | 60060 | 989f16bdf606205fceceb38674169bf3cbb84b7326f156e65eed59e033e742eb |

Both export to `loose/logo.webp`, texture `punchies:logo`. No secondary wordmark
is loaded. The separate `punch_logo` file is a boxing-glove icon, not this title.
Source repair used the built-in imagegen tool; derived sizes never use imagegen.
Reproducible export and alpha/small-scale proofs are saved in Art's
`outputs/punchies-logo-definitive-v1`. Do not regenerate the branding in a build.

The standard packer applies the canonical derivative after loose-file packing.
Every edition/profile build applies it again after archived/staging art overlays,
before edition selection and embedding the manifest. This prevents an old archive
or duplicate `logo.png` from restoring the broken wordmark. Other assets are not
recompressed. `asset-profile.json.logoArt` records the delivered profile/hash.

All consumers share `artImage(..., 'logo', ...)`: title-menu pulse, first-run
language selection, boot/loading foreground and scrolling stamps, and between-
round splash foreground/stamps. The helper preserves natural aspect and a
center pivot for both source sizes; the old v4 pixel-size exception is removed.

Approved five-fighter art retains the six non-logo layers byte-for-byte. Only
layer 07 is replaced. Current key art is `outputs/five-fighter-key-art-v2`;
logo-bearing platform exports are `outputs/five-fighter-collateral-v2`.
Prior output directories are superseded provenance, not current branding.

Focused verification: TypeScript, logo registration/profile tests, stale-archive
override and repeatability checks, alpha on white/navy/checker, small-scale
proofs, actual Brave title menu and first-run language chooser. Build owns final
edition/package verification and release integration.

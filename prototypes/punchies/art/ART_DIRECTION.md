# Mirrored limbs

Generate one glove or boot when the counterpart is a mirror. Derive the opposite
side in code, preserving correct thumb/toe orientation and rig registration.
Do not generate two independent versions of a mirrored pair.

Existing pairs are collapsed only when source RGBA pixels prove an exact mirror.
Distinct anatomy or lighting remains separate. The packer detects these pairs
and ArtBoot creates the counterpart once before cosmetic textures are derived.
Lossless image optimization preserves full dimensions and registration; masters
remain in R2 and are never overwritten by compressed build output.

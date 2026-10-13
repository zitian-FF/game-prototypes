# Approved Tee profile parity

The verified production profile pair differs only by compact's `loose/materialmask_tee.png` and matching JSON metadata. Standard deliberately uses its approved canonical portrait through the existing source-resolution palette fallback. Both currently have 766x700 geometry; this is a delivery-policy distinction, not a claim that the source is larger.

The parity gate requires both compact files, verifies the exact reviewed PNG hash and byte count, alpha and dimensions, prepared portrait identity, metadata and approval provenance. It verifies standard's canonical portrait hash/bytes and explicit fallback record. Every other texture/animation key, atlas registration JSON, mirror alias and fighter part remains subject to strict equality; every delivered manifest entry is hash-checked.

Validation used the original successful standard/compact build artifacts from run38328930100, whose parity job alone failed. No recompression or replacement assets were needed. Both pass the corrected gate; removing the compact mask or an ordinary logo key is rejected. Overlay manifest hashes describe the prepared archive, including animation indexes later embedded by Vite; they are not hashes of the pruned delivered manifest.

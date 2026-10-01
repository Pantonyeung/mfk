# Hero carousel asset slots

The four filenames are stable R2 slots. To update artwork without changing app code:

1. Replace the matching WebP while keeping its filename, 720 x 900 canvas and transparency.
2. Update its SHA-256 in `manifest.json` and `src/assets.ts`.
3. Push this branch or run the Customer V3 workflow manually.

The workflow overwrites the same R2 object key, then rebuilds the isolated preview.

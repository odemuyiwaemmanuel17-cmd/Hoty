# Cinematic photography set

All imagery in `cinematic/` is processed from the owner-uploaded reference
photography (originals preserved untouched in `_src2/`; the earlier `_src/`
batch is superseded and no longer referenced).

Pipeline per asset: resize ≤1600px, unsharp, WebP q78–84; alpha cut-outs via
black/white keying where the background allowed, feathered vignettes on the
hero and rotisserie plates, and the exploded-stack reference sliced into four
independent ingredient layers.

Components never hardcode these paths — everything resolves through
`src/assets/cinematic/assetManifest.ts`.

License note: owner-supplied imagery for this restaurant only; do not republish.

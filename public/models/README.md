# Production 3D model drop-points

Place models here:

    shawarma.glb   — hero: photorealistic shawarma (auto-centered, scaled to height 2.5)
    grill.glb      — Scene 2: full rotisserie grill assembly (scaled to height ~3)

The hero pipeline (`src/core/hooks/useHeroAsset.ts`) and `useSceneAsset()` HEAD-probe these
paths on scene start. When present they replace the labelled TEMPORARY procedural stand-ins;
GLB with embedded textures (KTX2/Basis recommended for delivery) works best; Draco/meshopt
compression supported by drei's useGLTF.

Requirements for the production asset:
- Realistic PBR materials (bread char, meat glisten, foil/ paper wrap)
- Height normalized around 20–30 cm authored scale (script rescales anyway)
- Under ~4 MB for mobile-first delivery

Until this file exists, the scene shows the honest abstract ember stage —
never fake food primitives.

#!/usr/bin/env bash
#
# Assembles the full staffcommander.netlify.app site into ./_site, building the
# 3D game from source instead of committing its compiled bundle. This is the
# Netlify build command (see netlify.toml). Run it locally to preview a deploy.
#
# Published layout (served at the domain root):
#   /index.html, /grand-staff-prix.html, /staff-blaster.html  static landing + 2D games
#   /images/                                                   shared art
#   /_redirects                                                rewrites /backdrops/* etc. -> /gsp-3d/
#   /rhythm/                                                   rhythm game (committed build, copied as-is)
#   /gsp-3d/                                                   Grand Staff Prix 3D, BUILT FROM SOURCE here
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=_site
rm -rf "$OUT"
mkdir -p "$OUT"

echo "→ static landing, 2D games, shared assets, redirect rules"
cp index.html grand-staff-prix.html staff-blaster.html _redirects "$OUT"/
cp -R images "$OUT"/images

echo "→ rhythm game (committed build, copied as-is)"
cp -R rhythm "$OUT"/rhythm

echo "→ Grand Staff Prix 3D (building from source)"
( cd grand-staff-prix-3d && npm ci && npm run build )
cp -R grand-staff-prix-3d/dist "$OUT"/gsp-3d

echo "✓ assembled $OUT:"
ls -1 "$OUT"

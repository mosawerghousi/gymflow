#!/usr/bin/env bash
# Generates the raster GymFlow brand assets (favicon.ico, OG image, apple icon)
# from the same geometry as public/brand/icon.svg.
#
# Requires ImageMagick (`convert`). Run from the repo root:
#   ./scripts/generate-brand-assets.sh
set -euo pipefail

OUT_DIR="public/brand"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

EMERALD_LIGHT="#34D399"
EMERALD="#10B981"
SLATE_BG="#0B1220"

# --- 1. The mark, drawn as a white alpha mask on a 256x256 canvas -------------
# Geometry is icon.svg's 64-unit viewBox scaled 4x.
convert -size 256x256 xc:none \
  -fill white -stroke none \
  -draw "roundrectangle 16,80 44,176 14,14" \
  -draw "roundrectangle 52,56 88,200 18,18" \
  -draw "roundrectangle 212,80 240,176 14,14" \
  -draw "roundrectangle 168,56 204,200 18,18" \
  -fill none -stroke white -strokewidth 20 \
  -draw "stroke-linecap round stroke-linejoin round path 'M 88,128 L 108,128 L 122,90 L 140,166 L 154,128 L 168,128'" \
  "$TMP_DIR/mask.png"

# White mark (used on the emerald favicon tile)
cp "$TMP_DIR/mask.png" "$TMP_DIR/mark-white.png"

# Gradient-filled mark (used on dark backgrounds)
convert -size 256x256 "gradient:${EMERALD_LIGHT}-${EMERALD}" \
  "$TMP_DIR/mask.png" -alpha off -compose CopyOpacity -composite \
  "$TMP_DIR/mark-emerald.png"

# --- 2. Favicon: emerald tile + white mark -----------------------------------
convert -size 256x256 xc:none \
  -fill white -draw "roundrectangle 0,0 255,255 56,56" \
  "$TMP_DIR/tile-mask.png"

convert -size 256x256 "gradient:${EMERALD_LIGHT}-${EMERALD}" \
  "$TMP_DIR/tile-mask.png" -alpha off -compose CopyOpacity -composite \
  "$TMP_DIR/tile.png"

convert "$TMP_DIR/mark-white.png" -resize 192x192 "$TMP_DIR/mark-small.png"
convert "$TMP_DIR/tile.png" "$TMP_DIR/mark-small.png" -gravity center -compose over -composite \
  "$TMP_DIR/favicon-256.png"

convert "$TMP_DIR/favicon-256.png" \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  -delete 0 -alpha on "$OUT_DIR/favicon.ico"

cp "$TMP_DIR/favicon-256.png" "$OUT_DIR/icon-256.png"
convert "$TMP_DIR/favicon-256.png" -resize 180x180 "$OUT_DIR/apple-icon.png"

# --- 3. Open Graph image (1200x630) ------------------------------------------
FONT_BOLD="Liberation-Sans-Bold"
FONT_REG="Liberation-Sans"

# Dark slate base with an emerald glow bleeding in from the right.
convert -size 1200x630 "xc:${SLATE_BG}" \
  \( -size 1200x630 radial-gradient:"#10B981"-"#0B1220" -resize 200% -gravity east -crop 1200x630+0+0 +repage \) \
  -compose blend -define compose:args=22 -composite \
  "$TMP_DIR/og-bg.png"

convert "$TMP_DIR/mark-emerald.png" -resize 148x148 "$TMP_DIR/og-mark.png"

# Measure "Gym" so "Flow" starts exactly where it ends, at any font/size.
GYM_W=$(convert -font "$FONT_BOLD" -pointsize 104 -kerning -3 label:'Gym' -format "%w" info:)
FLOW_X=$((96 + GYM_W + 4))

convert "$TMP_DIR/og-bg.png" \
  "$TMP_DIR/og-mark.png" -geometry +96+92 -composite \
  -font "$FONT_BOLD" -pointsize 104 -kerning -3 \
  -fill "#F8FAFC" -annotate +96+330 "Gym" \
  -fill "$EMERALD" -annotate "+${FLOW_X}+330" "Flow" \
  -font "$FONT_REG" -pointsize 40 -kerning 0 -fill "#94A3B8" \
  -annotate +98+404 "Gym management for owners, front desk, and trainers." \
  -font "$FONT_REG" -pointsize 30 -fill "#64748B" \
  -annotate +98+470 "Members  ·  Check-ins  ·  Scheduling  ·  Analytics" \
  -fill "$EMERALD" -draw "roundrectangle 96,520 216,528 4,4" \
  "$OUT_DIR/og.png"

echo "Brand assets written to $OUT_DIR:"
ls -1 "$OUT_DIR"

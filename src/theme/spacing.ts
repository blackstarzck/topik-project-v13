/**
 * Layout spacing scale (px) for inline styles on user-facing surfaces.
 *
 * Mirrors the runtime spacing rhythm documented in DESIGN.md, plus AntD's margin token ladder
 * (marginXS≈8, margin=16, marginLG=24, marginXL=32). Use these NAMED tokens in
 * inline styles instead of magic numbers — keeps the M4 inline-style gate green
 * (identifier values are exempt) and centralizes the spacing rhythm. Plain
 * constants (not a CSS var) so React Server Components can use them without the
 * theme runtime.
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

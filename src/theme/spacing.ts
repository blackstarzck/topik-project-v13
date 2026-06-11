/**
 * Layout spacing scale (px) for inline styles on user-facing surfaces.
 *
 * Mirrors the Awesomic 4px spacing ladder at the common TALKPIK sizes
 * (4/8/16/24/32). Use these NAMED tokens in inline styles instead of magic
 * numbers — keeps the inline-style gate clear and centralizes the spacing
 * rhythm. Plain constants (not a CSS var) so React Server Components can use
 * them without the theme runtime.
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

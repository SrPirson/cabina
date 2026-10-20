import type { Strings } from '../types'

// ok/warn/danger: tramos de las barras (<60 %, <85 %, resto); accent: trabajando y agentes; branch: rama git.
export type Theme = { ok: string; warn: string; danger: string; accent: string; branch: string }
export type Mode = 'dark' | 'light'

// Cada tema con una paleta por modo: la de fondo oscuro no se lee sobre claro, ni al revés.
// tests/contrast.test.ts comprueba que cada color llega a 3:1 sobre su fondo (WCAG, gráficos).
type ThemeDef = { dark: Theme; light: Theme; bg?: Partial<Record<Mode, string>> }

const DEFS = {
  // Sin fondo propio usa los colores del tema de Claude Code (CLASSIC_NATIVE); estos, sobre un fondo pintado.
  classic: {
    dark: { ok: '#3fb950', warn: '#d29922', danger: '#f85149', accent: '#d97757', branch: '#58a6ff' },
    light: { ok: '#1a7f37', warn: '#9a6700', danger: '#cf222e', accent: '#b6532f', branch: '#0969da' },
  },
  catppuccin: {
    dark: { ok: '#a6e3a1', warn: '#f9e2af', danger: '#f38ba8', accent: '#cba6f7', branch: '#89b4fa' },
    light: { ok: '#3a8f27', warn: '#c27a10', danger: '#d20f39', accent: '#8839ef', branch: '#1e66f5' },
    bg: { dark: '#1e1e2e', light: '#eff1f5' },
  },
  dracula: {
    dark: { ok: '#50fa7b', warn: '#f1fa8c', danger: '#ff5555', accent: '#bd93f9', branch: '#8be9fd' },
    light: { ok: '#14710a', warn: '#846e15', danger: '#cb3a2a', accent: '#644ac9', branch: '#036a96' },
    bg: { dark: '#282a36', light: '#fffbeb' },
  },
  nord: {
    dark: { ok: '#a3be8c', warn: '#ebcb8b', danger: '#d08770', accent: '#88c0d0', branch: '#81a1c1' },
    light: { ok: '#4f7a34', warn: '#946200', danger: '#a3333d', accent: '#2e6d85', branch: '#4c6a92' },
    bg: { dark: '#2e3440', light: '#eceff4' },
  },
  'tokyo-night': {
    dark: { ok: '#9ece6a', warn: '#e0af68', danger: '#f7768e', accent: '#7aa2f7', branch: '#bb9af7' },
    light: { ok: '#4f6b2f', warn: '#8c6c3e', danger: '#c4204f', accent: '#2e6bd1', branch: '#7847bd' },
    bg: { dark: '#1a1b26', light: '#e1e2e7' },
  },
  gruvbox: {
    dark: { ok: '#b8bb26', warn: '#fabd2f', danger: '#fb4934', accent: '#fe8019', branch: '#83a598' },
    light: { ok: '#79740e', warn: '#9a6312', danger: '#9d0006', accent: '#af3a03', branch: '#076678' },
    bg: { dark: '#282828', light: '#fbf1c7' },
  },
  github: {
    dark: { ok: '#3fb950', warn: '#d29922', danger: '#f85149', accent: '#a371f7', branch: '#58a6ff' },
    light: { ok: '#1a7f37', warn: '#9a6700', danger: '#cf222e', accent: '#8250df', branch: '#0969da' },
    bg: { dark: '#0d1117', light: '#ffffff' },
  },
  solarized: {
    dark: { ok: '#859900', warn: '#b58900', danger: '#e0524f', accent: '#268bd2', branch: '#2aa198' },
    light: { ok: '#5f6e00', warn: '#8a6800', danger: '#c4271f', accent: '#1d6fae', branch: '#1b7a73' },
    bg: { dark: '#002b36', light: '#fdf6e3' },
  },
  // Okabe-Ito: distinguible con protanopía, deuteranopía y tritanopía.
  colorblind: {
    dark: { ok: '#56b4e9', warn: '#e69f00', danger: '#d55e00', accent: '#cc79a7', branch: '#009e73' },
    light: { ok: '#0072b2', warn: '#9c6500', danger: '#b34f00', accent: '#a8507f', branch: '#00795a' },
  },
  contrast: {
    dark: { ok: '#00ff00', warn: '#ffff00', danger: '#ff5050', accent: '#00ffff', branch: '#ffffff' },
    light: { ok: '#006400', warn: '#6b5200', danger: '#b00000', accent: '#0000cc', branch: '#000000' },
    bg: { dark: '#000000', light: '#ffffff' },
  },
  mono: {
    dark: { ok: '#e6e6e6', warn: '#e6e6e6', danger: '#ffffff', accent: '#e6e6e6', branch: '#b8b8b8' },
    light: { ok: '#24292f', warn: '#24292f', danger: '#000000', accent: '#24292f', branch: '#4b535c' },
  },
} satisfies Record<string, ThemeDef>

// Clásico sin fondo propio: los colores del tema de Claude Code, que ya se adaptan al de la terminal.
const CLASSIC_NATIVE: Theme = { ok: 'success', warn: 'warning', danger: 'error', accent: 'claude', branch: 'suggestion' }

export type ThemeId = keyof typeof DEFS

export const THEME_IDS = Object.keys(DEFS) as ThemeId[]

export const isThemeId = (id: string): id is ThemeId => id in DEFS

const defOf = (id: string): ThemeDef => (isThemeId(id) ? DEFS[id] : DEFS.classic)

export const themeOf = (id: string, mode: Mode, isPainted: boolean): Theme =>
  !isPainted && (id === 'classic' || !isThemeId(id)) ? CLASSIC_NATIVE : defOf(id)[mode]

// Los nombres propios no se traducen; los descriptivos sí.
export const themeName = (t: Strings, id: ThemeId) =>
  ({
    classic: t.tClassic, colorblind: t.tColorblind, contrast: t.tContrast, mono: t.tMono,
    catppuccin: 'Catppuccin', dracula: 'Dracula', nord: 'Nord', 'tokyo-night': 'Tokyo Night',
    gruvbox: 'Gruvbox', github: 'GitHub', solarized: 'Solarized',
  })[id]

export const toneOf = (theme: Theme, pct: number) => (pct >= 85 ? theme.danger : pct >= 60 ? theme.warn : theme.ok)

// Fondo del panel: 'auto' deja el de la terminal; oscuro y claro lo pintan, con texto a juego.
export const BACKGROUNDS = ['auto', 'dark', 'light'] as const
export type Background = (typeof BACKGROUNDS)[number]
// fg: texto; sub: texto secundario (en vez de dimColor, que sobre claro se queda sin contraste); muted: raíl de las barras.
export type Surface = { mode: Mode; bg: string; fg: string; sub: string; muted: string }

// Fondos con los que se mide el contraste cuando no se pinta (el de la terminal es desconocido).
export const NEUTRAL_BG: Record<Mode, string> = { dark: '#1e1e1e', light: '#ffffff' }

export const surfaceOf = (themeId: string, background: string): Surface | undefined => {
  if (background !== 'dark' && background !== 'light') return undefined
  const bg = defOf(themeId).bg?.[background] ?? (background === 'dark' ? '#1e1e1e' : '#fafafa')
  return background === 'dark'
    ? { mode: 'dark', bg, fg: '#e6e6e6', sub: '#a8a8a8', muted: '#4a4a4a' }
    : { mode: 'light', bg, fg: '#1f2328', sub: '#545d68', muted: '#c4c9d0' }
}

// Contraste WCAG 2.x entre dos colores #rrggbb, de 1 a 21.
export const contrast = (a: string, b: string) => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

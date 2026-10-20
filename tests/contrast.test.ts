import { expect, test } from 'claude-code/testing'

import { contrast, NEUTRAL_BG, surfaceOf, THEME_IDS, themeOf } from '../hooks/themes'

test('la fórmula de contraste da los valores de referencia', async () => {
  expect(Math.round(contrast('#000000', '#ffffff'))).toBe(21)
  expect(contrast('#ffffff', '#ffffff')).toBe(1)
})

// Cada tema, en cada modo, sobre su propio fondo pintado y sobre uno neutro (fondo «Terminal»):
// colores de barras y acentos ≥ 3:1, texto ≥ 7:1 y texto secundario ≥ 4.5:1.
test('todos los temas tienen contraste suficiente en claro y en oscuro', async () => {
  const fails: string[] = []
  for (const id of THEME_IDS) {
    for (const mode of ['dark', 'light'] as const) {
      const surface = surfaceOf(id, mode)!
      const checks: [string, string, string, number][] = [
        [`${id}/${mode} fg`, surface.fg, surface.bg, 7],
        [`${id}/${mode} sub`, surface.sub, surface.bg, 4.5],
      ]
      for (const [bgName, bg, painted] of [['own', surface.bg, true], ['neutral', NEUTRAL_BG[mode], false]] as const) {
        const theme = themeOf(id, mode, painted)
        if (!theme.ok.startsWith('#')) continue // clásico nativo: colores de Claude Code
        for (const [key, color] of Object.entries(theme)) checks.push([`${id}/${mode}/${bgName} ${key}`, color, bg, 3])
      }
      for (const [name, color, bg, min] of checks) {
        const ratio = contrast(color, bg)
        if (ratio < min) fails.push(`${name} ${color} sobre ${bg}: ${ratio.toFixed(2)} < ${min}`)
      }
    }
  }
  expect(fails).toEqual([])
})

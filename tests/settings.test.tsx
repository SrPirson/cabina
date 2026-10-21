import { expect, test } from 'claude-code/testing'

const SETTINGS = {
  plugin: 'cabina',
  component: 'Pane',
  requestId: 'cabina',
  props: {
    title: 'Cabina',
    isFocused: true,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const ROWS = ['language', 'customLanguage', 'theme'].map(f => ({ key: `cabina.${f}`, label: f }))

test('elegir tema e idioma en el panel de ajustes lo guarda en /config, en cada superficie', async ($, on) => {
  // Hace de /config: lista las tres filas del mod y apunta lo que se guarda.
  const saved: Record<string, unknown> = {}
  on('config.list', () => ({ value: ROWS }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('config.set', (_, e) => {
    saved[e.key] = e.value
    return { value: e.value } as never
  })
  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({ ...SETTINGS, surface })
    await ui.press({ key: 'settings' })
    await ui.select({ key: 'theme', value: 'dracula' })
    await ui.select({ key: 'language', value: 'es' })
    expect(saved['cabina.theme']).toBe('dracula')
    expect(saved['cabina.language']).toBe('es')
    await ui.press({ key: 'close' })
    expect(await ui.find({ type: 'Text', text: /Context/ })).toBeDefined()
    await ui.unmount()
  }
  // Móvil no tiene Select: botones.
  const ui = await $.ui.mount({ ...SETTINGS, surface: 'mobile' })
  await ui.press({ key: 'settings' })
  await ui.press({ key: 'theme-nord' })
  await ui.press({ key: 'lang-fr' })
  expect(saved['cabina.theme']).toBe('nord')
  expect(saved['cabina.language']).toBe('fr')
  await ui.unmount()
})

test('/cabina theme y /cabina language guardan sin abrir nada', async ($, on) => {
  // Hace de /config: lista las tres filas del mod y apunta lo que se guarda.
  const saved: Record<string, unknown> = {}
  on('config.list', () => ({ value: ROWS }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('config.set', (_, e) => {
    saved[e.key] = e.value
    return { value: e.value } as never
  })
  await $.command.run({ command: 'cabina', args: 'theme nord' } as never)
  expect(saved['cabina.theme']).toBe('nord')
  await $.command.run({ command: 'cabina', args: 'idioma swahili' } as never)
  expect(saved['cabina.customLanguage']).toBe('swahili')
  expect(saved['cabina.language']).toBe('custom')
  const bad = await $.command.run({ command: 'cabina', args: 'theme rosa' } as never)
  expect(JSON.stringify(bad)).toContain('catppuccin')
})

test('los apartados ocultos no se dibujan y ⚙ Ajustes sigue a mano', { options: { show_cost: false, show_project: false } }, async $ => {
  const ui = await $.ui.mount({ ...SETTINGS, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^USAGE$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^COST$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^PROJECT$/ })).toBeUndefined()
  expect(await ui.find({ key: 'settings' })).toBeDefined()
  await ui.unmount()
})

test('elegir un apartado en Ajustes lo oculta, y otra vez lo muestra', { options: { show_trend: false } }, async ($, on) => {
  const saved: Record<string, unknown> = {}
  on('config.list', () => ({ value: ['show_trend', 'show_files'].map(f => ({ key: `cabina.${f}`, label: f })) }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('config.set', (_, e) => {
    saved[e.key] = e.value
    return { value: e.value } as never
  })
  const ui = await $.ui.mount({ ...SETTINGS, surface: 'terminal' })
  await ui.press({ key: 'settings' })
  await ui.select({ key: 'sections', value: 'files' })
  expect(saved['cabina.show_files']).toBe(false)
  await ui.select({ key: 'sections', value: 'trend' })
  expect(saved['cabina.show_trend']).toBe(true)
  await ui.unmount()
})

test('/cabina close y /cabina cerrar cierran el panel', async ($, on) => {
  const closed: string[] = []
  on('ui.close', (_, e) => {
    closed.push(e.id)
    return { value: undefined } as never
  })
  await $.command.run({ command: 'cabina', args: 'close' } as never)
  await $.command.run({ command: 'cabina', args: 'cerrar' } as never)
  expect(closed).toEqual(['cabina', 'cabina'])
})

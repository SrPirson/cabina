import { expect, test } from 'claude-code/testing'

import { agentUsage, prettyModel, relPath, shortPath, shortstat, spark, span, tokens } from '../hooks/register'
import { themeOf, toneOf } from '../hooks/themes'

test('formatos', async () => {
  expect(prettyModel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(prettyModel('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5 1M')
  expect(prettyModel('claude-opus-4-20250514')).toBe('Opus 4')
  expect(prettyModel('opus')).toBe('opus')
  expect(tokens(222_000)).toBe('222k')
  expect(tokens(1_000_000)).toBe('1M')
  expect(tokens(1_250_000)).toBe('1.3M')
  expect(span(12_000)).toBe('12s')
  expect(span(161 * 60_000)).toBe('2h 41m')
  expect(span((3 * 1440 + 4 * 60) * 60_000)).toBe('3d 4h')
  expect(toneOf(themeOf('classic', 'dark', false), 10)).toBe('success')
  expect(toneOf(themeOf('classic', 'dark', false), 70)).toBe('warning')
  expect(toneOf(themeOf('classic', 'dark', false), 90)).toBe('error')
  expect(shortPath('E:\\Programacion\\Proyectos\\cabina')).toBe('…/Proyectos/cabina')
  expect(spark([0, 50, 100], 100)).toBe('▁▅█')
  expect(spark([1, 2])).toBe('▅█')
  expect(relPath('E:\\Proyectos\\cabina\\hooks\\i18n.ts', 'E:\\Proyectos\\cabina')).toBe('hooks/i18n.ts')
  expect(relPath('C:/otro/x.ts', 'E:/Proyectos/cabina')).toBe('C:/otro/x.ts')
  expect(shortstat(' 3 files changed, 120 insertions(+), 34 deletions(-)')).toEqual({ plus: 120, minus: 34 })
  expect(shortstat(' 1 file changed, 2 deletions(-)')).toEqual({ plus: 0, minus: 2 })
  expect(shortstat('')).toEqual({ plus: 0, minus: 0 })
})

test('el panel se dibuja en todas las superficies', async $ => {
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({
      plugin: 'cabina',
      component: 'Pane',
      requestId: 'cabina',
      surface,
      props: {
        title: 'Cabina',
        isFocused: false,
        bodyColumns: 40,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 20 },
        view: {},
      },
    })
    expect(await ui.find({ type: 'Text', text: /Context/ })).toBeDefined()
    for (const heading of [/^USAGE$/, /^COST$/, /^PROJECT$/]) {
      expect(await ui.find({ type: 'Text', text: heading })).toBeDefined()
    }
    await ui.unmount()
  }
})

test('con fondo claro el panel se pinta y el texto pasa a oscuro', { options: { background: 'light', theme: 'nord' } }, async $ => {
  const ui = await $.ui.mount({
    plugin: 'cabina',
    component: 'Pane',
    requestId: 'cabina',
    surface: 'terminal',
    props: {
      title: 'Cabina',
      isFocused: false,
      bodyColumns: 40,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 20 },
      view: {},
    },
  })
  const label = await ui.find({ type: 'Text', text: /^Context$/ })
  expect(label?.props.color).toBe('#545d68')
  const root = await ui.find({ type: 'Box' })
  expect(root?.props.backgroundColor).toBe('#eceff4')
  await ui.unmount()
})

test('cambiar de modelo con /model o de esfuerzo con /effort se ve en el panel sin esperar al siguiente turno', async ($, on) => {
  on('session.model', async () => ({ value: 'claude-sonnet-5-5' }))
  on('settings.read', async () => ({ value: { modelSettings: { 'claude-sonnet-5-5': { effortLevel: 'low' } } } }))
  const ui = await $.ui.mount({
    plugin: 'cabina',
    component: 'Pane',
    requestId: 'cabina',
    surface: 'terminal',
    props: {
      title: 'Cabina',
      isFocused: false,
      bodyColumns: 40,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 20 },
      view: {},
    },
  })
  expect(await ui.find({ type: 'Text', text: /^Sonnet 5\.5$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' · low' })).toBeDefined()
  await ui.unmount()
})

test('consumo de un subagente', async () => {
  const a = { id: 'a1', type: 'Explore', desc: 'x', tokens: 56_400, out: 3_000, tools: 4, startedAt: 8_000 }
  expect(agentUsage(a, 30_000)).toBe('56k · ↓ 3k · 22s')
  expect(agentUsage({ ...a, endedAt: 20_000 }, 30_000)).toBe('56k · ↓ 3k · 12s')
})

test('un hook de settings.json aparece en Hooks y marca cuándo bloquea', async ($, on) => {
  on('settings.read', async () => ({ value: { hooks: { Stop: [], PreToolUse: [] } } }))
  on('classic.Stop', async () => ({ block: 'falta el changelog' }))
  on('clock.now', () => ({ value: 1_000 }))
  const props = {
    title: 'Cabina', isFocused: false, bodyColumns: 40, placement: 'dock' as const,
    scroll: { offset: 0, bodyRows: 60 }, view: {},
  }
  let ui = await $.ui.mount({ plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface: 'terminal', props })
  expect(await ui.find({ type: 'Text', text: /^HOOKS$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'PreToolUse' })).toBeDefined()
  await ui.unmount()

  await $.classic.Stop({ stop_hook_active: false })
  ui = await $.ui.mount({ plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface: 'terminal', props })
  expect(await ui.find({ type: 'Text', text: /^blocked · / })).toBeDefined()
  await ui.unmount()
})

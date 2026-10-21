import { expect, test } from 'claude-code/testing'

import { prettyModel, relPath, shortPath, shortstat, spark, span, tokens } from '../hooks/register'
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

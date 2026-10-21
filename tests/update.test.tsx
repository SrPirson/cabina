import { expect, test } from 'claude-code/testing'

import { isNewer } from '../hooks/register'

test('compara versiones número a número', async () => {
  expect(isNewer('1.0.10', '1.0.9')).toBe(true)
  expect(isNewer('1.1', '1.0.3')).toBe(true)
  expect(isNewer('1.0.3', '1.0.3')).toBe(false)
  expect(isNewer('1.0.2', '1.0.3')).toBe(false)
})

test('con una versión nueva el botón la instala con un clic', async ($, on) => {
  const ran: string[] = []
  on('config.list', () => ({ value: [{ key: 'cabina@cabina.theme', label: 'theme' }] }) as never)
  on('process.run', (_, e) => {
    ran.push(e.argv.join(' '))
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('fs.read', () => ({ value: '{ "version": "1.0.3" }' }) as never)
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '{ "version": "1.0.4" }' } }))
  // Lo que session.start pregunta al motor, respondido en blanco.
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: {} }) as never)
  on('settings.read', () => ({ value: {} }) as never)
  on('ui.toast', () => ({ value: {} }) as never)
  on('session.cwd', () => ({ value: '/p' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.turns', () => ({ value: 0 }))
  on('session.usage', () => ({ value: { context: { tokens: 0, window: 0 }, rateLimits: [] } }) as never)
  on('clock.now', () => ({ value: 0 }))
  on('clock.every', () => ({ value: {} }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({
    plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface: 'terminal',
    props: { title: 'Cabina', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: '↑ v1.0.4' })).toBeDefined()
  await ui.press({ key: 'update' })
  expect(ran.filter(c => c.startsWith('claude'))).toEqual(['claude plugin marketplace update cabina', 'claude plugin update cabina@cabina'])
  expect(await ui.find({ type: 'Text', text: '✓ v1.0.4' })).toBeDefined()
  await ui.unmount()
})

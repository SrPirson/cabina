import { expect, mock, test } from 'claude-code/testing'

import { agentUsage, dayKey, historyTotals, pace, patchStat, prettyModel, relPath, shortPath, shortstat, spark, span, statusText, tokens } from '../hooks/register'
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

test('si classic.PreToolUse llega a Cabina, el seguimiento en vivo no se apaga', async ($, on) => {
  const saved: unknown[] = []
  on('config.list', () => ({ value: [{ key: 'cabina@cabina.track_hooks', label: 'track_hooks' }] }) as never)
  on('config.set', (_, e) => { saved.push(e); return { value: {} } as never })
  on('tool.call', () => ({ result: {} }))
  for (const i of [1, 2, 3]) await $.tool.call({ tool: 'Bash', command: `echo ${i}` })
  expect(saved).toEqual([])
})

test('sin seguimiento en vivo, un bloqueo de un hook sí aparece en Hooks', { options: { track_hooks: false } }, async ($, on) => {
  on('settings.read', async () => ({ value: { hooks: { Stop: [], PreToolUse: [] } } }))
  on('clock.now', () => ({ value: 1_000 }))
  const props = {
    title: 'Cabina', isFocused: false, bodyColumns: 40, placement: 'dock' as const,
    scroll: { offset: 0, bodyRows: 60 }, view: {},
  }
  let ui = await $.ui.mount({ plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface: 'terminal', props })
  expect(await ui.find({ type: 'Text', text: /^HOOKS$/ })).toBeUndefined()
  await ui.unmount()

  await $.session.append({
    message: { type: 'attachment', name: 'hook_blocking_error', content: [{ type: 'text', text: 'falta el changelog' }] },
    door: 'attachment', origin: { kind: 'hook', event: 'Stop' }, uuid: 'u1',
  } as never)
  ui = await $.ui.mount({ plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface: 'terminal', props })
  expect(await ui.find({ type: 'Text', text: /^HOOKS$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'PreToolUse' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^blocked · / })).toBeDefined()
  await ui.unmount()
})

test('ritmo de los límites: marca de ritmo uniforme y aviso si se agota antes del reinicio', async () => {
  const now = Date.parse('2026-10-27T12:00:00Z')
  const in2h = new Date(now + 2 * 3_600_000).toISOString()
  // Pasadas 3 de 5 horas: a ritmo uniforme iría por el 60 %.
  expect(pace({ kind: 'five_hour', percentUsed: 30, resetsAt: in2h }, now)).toEqual({ expected: 60, runsOutIn: undefined })
  // 90 % en 3 horas: el 10 % que queda dura 20 minutos, antes del reinicio.
  expect(pace({ kind: 'five_hour', percentUsed: 90, resetsAt: in2h }, now)?.runsOutIn).toBe(20 * 60_000)
  // En los primeros minutos de la ventana no se predice nada.
  const early = new Date(now + (5 * 60 - 5) * 60_000).toISOString()
  expect(pace({ kind: 'five_hour', percentUsed: 10, resetsAt: early }, now)?.runsOutIn).toBeUndefined()
  expect(pace({ kind: 'spend_limit', percentUsed: 50, resetsAt: in2h }, now)).toBeUndefined()
  expect(pace({ kind: 'five_hour', percentUsed: 50 }, now)).toBeUndefined()
})

test('líneas escritas por Edit y Write', async () => {
  expect(patchStat({ gitDiff: { additions: 3, deletions: 1 } })).toEqual({ plus: 3, minus: 1 })
  expect(patchStat({ structuredPatch: [{ lines: ['+a', '-b', ' c', '+d'] }] })).toEqual({ plus: 2, minus: 1 })
  expect(patchStat({ type: 'create', content: 'a\nb\nc', structuredPatch: [] })).toEqual({ plus: 3, minus: 0 })
  expect(patchStat(undefined)).toEqual({ plus: 0, minus: 0 })
})

test('historial de coste: hoy y los últimos 7 días', async () => {
  const now = new Date(2026, 9, 27, 15).getTime()
  expect(dayKey(now)).toBe('2026-10-27')
  const h = { '2026-10-27': 2, '2026-10-21': 1, '2026-10-20': 5 }
  expect(historyTotals(h, now)).toEqual({ today: 2, week: 3 })
})

test('línea de estado con el panel cerrado', async () => {
  const base = { model: '', ctxWindow: 0, limits: [], compactions: 0, agents: [], crew: [], hooks: {}, cwd: '', now: 0,
    files: [], tools: {}, toolErr: {}, prompts: 0, ctxTrend: [], costTrend: [], tokIn: 0, tokOut: 0, tokCache: 0,
    byModel: {}, linesPlus: 0, linesMinus: 0, log: [] }
  expect(statusText(base)).toBeUndefined()
  expect(statusText({ ...base, ctxPercent: 42.4, costUsd: 3.2, limits: [{ kind: 'five_hour', percentUsed: 60 }] }))
    .toBe('Cabina · ctx 42% · 5h 60% · $3.20')
})

test('una edición suma sus líneas y un fallo se cuenta y entra en el registro', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('tool.call', (_, e) => (e.tool === 'Edit'
    ? { result: { gitDiff: { additions: 3, deletions: 1 } } }
    : { result: {}, isError: true, text: 'boom' }) as never)
  await $.tool.call({ tool: 'Edit', file_path: '/p/x.ts', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Bash', command: 'false' } as never)
  const ui = await $.ui.mount({
    plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface: 'terminal',
    props: { title: 'Cabina', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: /\+3 −1/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^LOG$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Bash · boom' })).toBeDefined()
  await ui.unmount()
})

test('compactar pide una segunda pulsación', async ($, on) => {
  const ran: string[] = []
  const clock = mock.clock(on)
  on('ui.panes', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('session.measure', () => ({ changed: [] }) as never)
  on('command.run', (_, e) => {
    ran.push(e.command)
    return { text: '' } as never
  })
  await $.session.measure({ context: { tokens: 80_000, window: 100_000, percent: 80 }, rateLimits: [], changed: [] } as never)
  const ui = await $.ui.mount({
    plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface: 'terminal',
    props: { title: 'Cabina', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  await ui.press({ key: 'compact' })
  await clock.settle()
  expect(ran).toEqual([])
  expect(await ui.find({ key: 'compact' })).toMatchObject({ props: { label: 'compact? press again' } })
  await ui.press({ key: 'compact' })
  await clock.settle()
  expect(ran).toEqual(['compact'])
  await ui.unmount()
})

test('encima del prompt, un resumen corto', async $ => {
  const ui = await $.ui.mount({
    plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface: 'terminal',
    props: { title: 'Cabina', isFocused: false, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 8 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: /^Context$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^USAGE$/ })).toBeUndefined()
  await ui.unmount()
})

test('trabajando, el cronómetro avanza solo en terminal y es texto en móvil', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }) as never)
  await $.turn.start({ text: 'hola', turnId: 't1' } as never)
  for (const surface of ['terminal', 'mobile'] as const) {
    const ui = await $.ui.mount({
      plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface,
      props: { title: 'Cabina', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
    })
    if (surface === 'terminal') expect(await ui.find({ key: 'busy' })).toMatchObject({ type: 'Client' })
    else expect(await ui.find({ type: 'Text', text: '0s' })).toBeDefined()
    await ui.unmount()
  }
})

test('con un agente en marcha y el fondo de la terminal, el panel se dibuja', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }) as never)
  on('agent.list', () => ({ value: [{ id: 'a1', type: 'Explore', description: 'Buscar', status: 'running' }] }) as never)
  await $.turn.start({ text: '', turnId: 't1', agentId: 'a1' } as never)
  const ui = await $.ui.mount({
    plugin: 'cabina', component: 'Pane', requestId: 'cabina', surface: 'terminal',
    props: { title: 'Cabina', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  expect(await ui.find({ key: 'agent-a1' })).toMatchObject({ type: 'Client' })
  // El tiempo va en la misma fila que los tokens, no en una caja aparte.
  const row = await ui.find({ type: 'Box', text: /^0 · ↓ 0 · $/ })
  expect(row?.children.map(c => (c as { type: string }).type)).toEqual(['Text', 'Client'])
  await ui.unmount()
})

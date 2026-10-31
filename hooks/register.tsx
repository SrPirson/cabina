import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentStat, LogEntry, RateLimit, Snapshot, Strings } from '../types'
import { BUILT_IN, ENDONYM, fill, normalize, parseStrings, translatePrompt } from './i18n'
import { span } from './span'
import { BACKGROUNDS, isThemeId, surfaceOf, THEME_IDS, themeName, themeOf, toneOf } from './themes'

const PANE = 'cabina'
const EMPTY: Snapshot = {
  model: '', ctxWindow: 0, limits: [], compactions: 0, agents: [], crew: [], hooks: {}, cwd: '', now: 0,
  files: [], tools: {}, toolErr: {}, prompts: 0, ctxTrend: [], costTrend: [], tokIn: 0, tokOut: 0, tokCache: 0,
  byModel: {}, linesPlus: 0, linesMinus: 0, log: [],
}
// Lo que /clear vacía: lo de la sesión. Modelo, proyecto, límites e historial siguen.
const CLEARED: Partial<Snapshot> = {
  compactions: 0, agents: [], crew: [], hooks: {}, files: [], tools: {}, toolErr: {}, prompts: 0,
  ctxTrend: [], costTrend: [], tokIn: 0, tokOut: 0, tokCache: 0, byModel: {}, linesPlus: 0, linesMinus: 0, log: [],
  ctxTokens: undefined, ctxPercent: undefined, costUsd: undefined, startedAt: undefined, lastTurn: undefined,
  busySince: undefined, tool: undefined, turnCostStart: undefined, tokPerSec: undefined, compactArmed: undefined,
}
const snap = atom({ plugin: 'cabina', key: 'snap' } as const, EMPTY)
const text = atom({ plugin: 'cabina', key: 'text' } as const, BUILT_IN.en!)
const view = atom({ plugin: 'cabina', key: 'view' } as const, 'main' as 'main' | 'settings')
// Filas que la lista de agentes está subida desde el final; 0 sigue a los más recientes.
const crewBack = atom({ plugin: 'cabina', key: 'crewBack' } as const, 0)
const CREW_ROWS = 6
const LOG_ROWS = 5
// Con el panel encima del prompt (fuera de pantalla completa), un resumen de este alto.
const OPEN = { id: PANE, title: 'Cabina', rows: 8 }
// Segundos que el botón de compactar espera la confirmación.
const CONFIRM_MS = 5000

// "claude-opus-5-5[1m]" → "Opus 5.5 1M"; lo que no encaje se muestra tal cual.
export const prettyModel = (id: string) => {
  const m = /^claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2})(?!\d))?/.exec(id)
  if (!m) return id
  const name = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1)
  return `${name} ${m[2]}${m[3] ? '.' + m[3] : ''}${/\[1m\]/i.test(id) ? ' 1M' : ''}`
}

export const tokens = (n: number) =>
  n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`

export { span }

// [3, 9, 1] → "▃█▁"; con `max`, escala absoluta (el contexto va de 0 a 100).
export const spark = (values: number[], max = Math.max(...values, 1e-9)) =>
  values.map(v => '▁▂▃▄▅▆▇█'[Math.min(7, Math.max(0, Math.round((v / max) * 7)))]).join('')

// Ruta relativa al directorio de la sesión, con barras normales.
export const relPath = (file: string, cwd: string) => {
  const f = file.replace(/\\/g, '/'), c = cwd.replace(/\\/g, '/').replace(/\/$/, '')
  return f.toLowerCase().startsWith(c.toLowerCase() + '/') ? f.slice(c.length + 1) : f
}

// "3 files changed, 120 insertions(+), 34 deletions(-)" → { plus: 120, minus: 34 }
export const shortstat = (out: string) => ({
  plus: Number(/(\d+) insertion/.exec(out)?.[1] ?? 0),
  minus: Number(/(\d+) deletion/.exec(out)?.[1] ?? 0),
})

// Cambia un subagente de la lista por id; si no está, nada.
const touchAgent = ($: EngineInterface, id: string, fn: (a: AgentStat) => AgentStat) =>
  bump($, s => ({ ...s, crew: s.crew.map(a => a.id === id ? fn(a) : a) }))

// Contexto de su última petición · salida sumada · tiempo (hasta ahora si sigue en curso).
export const agentUsage = (a: AgentStat, now: number) =>
  `${tokens(a.tokens)} · ↓ ${tokens(a.out)} · ${span((a.endedAt ?? now) - a.startedAt)}`

const pushTrend = (list: number[], v: number) => [...list, v].slice(-30)

// Duración de las ventanas de límite que se conocen; el reinicio dice cuánto ha pasado.
const WINDOW_MS: Record<string, number> = { five_hour: 5 * 3_600_000, seven_day: 7 * 86_400_000 }

// Ritmo de un límite: dónde iría con un gasto uniforme (0-100) y, si al ritmo de ahora se acaba
// antes del reinicio, en cuánto. Sin ventana conocida, nada; en el primer 5 % de la ventana no se predice.
export const pace = (l: RateLimit, now: number) => {
  const win = WINDOW_MS[l.kind]
  const left = l.resetsAt ? Date.parse(l.resetsAt) - now : NaN
  if (!win || !(left > 0) || left > win) return undefined
  const gone = win - left
  const runsOutIn = l.percentUsed > 0 && l.percentUsed < 100 && gone >= win / 20
    ? ((100 - l.percentUsed) / l.percentUsed) * gone : undefined
  return { expected: (gone / win) * 100, runsOutIn: runsOutIn !== undefined && runsOutIn < left ? runsOutIn : undefined }
}

// Líneas +/− de un Edit o Write: las de git si vienen; si no, las del parche (o el archivo entero si es nuevo).
export const patchStat = (result: unknown) => {
  const r = result as {
    gitDiff?: { additions: number; deletions: number }; structuredPatch?: { lines: string[] }[]; type?: string; content?: string
  } | undefined
  if (r?.gitDiff) return { plus: r.gitDiff.additions, minus: r.gitDiff.deletions }
  if (r?.type === 'create' && typeof r.content === 'string') return { plus: r.content.split('\n').length, minus: 0 }
  const lines = r?.structuredPatch?.flatMap(h => h.lines) ?? []
  return { plus: lines.filter(l => l.startsWith('+')).length, minus: lines.filter(l => l.startsWith('-')).length }
}

// Fecha local "2026-10-27": la clave del historial de coste.
export const dayKey = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Historial { día: usd } → coste de hoy y de los últimos 7 días (hoy incluido).
export const historyTotals = (h: Record<string, number>, now: number) => ({
  today: h[dayKey(now)] ?? 0,
  week: Array.from({ length: 7 }, (_, i) => h[dayKey(now - i * 86_400_000)] ?? 0).reduce((a, b) => a + b, 0),
})

// "opus" → "Opus"; el nombre corto de un modelo para listas apretadas.
const modelFamily = (id: string) => prettyModel(id).split(' ')[0]!

// Lo esencial en una línea, para la línea de estado con el panel cerrado.
const LIMIT_SHORT: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: '$' }
export const statusText = (s: Snapshot) => {
  const parts = [
    s.ctxPercent !== undefined ? `ctx ${Math.round(s.ctxPercent)}%` : undefined,
    ...s.limits.map(l => `${LIMIT_SHORT[l.kind] ?? l.kind} ${Math.round(l.percentUsed)}%`),
    s.costUsd !== undefined ? `$${s.costUsd.toFixed(2)}` : undefined,
  ].filter(Boolean)
  return parts.length ? `Cabina · ${parts.join(' · ')}` : undefined
}

export const shortPath = (p: string) => {
  const parts = p.split(/[\\/]+/).filter(Boolean)
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : p
}

// Idioma: tabla propia si la hay; si no, una traducción del modelo guardada en $.store; si falla, inglés.
const resolveStrings = async ($: EngineInterface, setting: string): Promise<Strings> => {
  let lang = setting.trim()
  if (!lang || lang.toLowerCase() === 'auto') {
    const v = await $.settings.read({ key: 'language' }).catch(() => undefined)
    lang = typeof v === 'string' && v.trim() ? v : 'en'
  }
  const code = normalize(lang)
  const built = BUILT_IN[code]
  if (built) return built
  const key = `i18n:v5:${code}`
  const cached = parseStrings(JSON.stringify((await $.store.get(key)) ?? null))
  if (cached) return cached
  const r = await $.model.complete({ model: 'haiku', prompt: translatePrompt(lang), maxTokens: 800 })
  const got = r.isAnswered ? parseStrings(r.text) : undefined
  if (!got) return BUILT_IN.en!
  await $.store.set(key, got)
  return got
}

// El panel es decorativo: si una escritura falla, la sesión sigue igual.
// Un estado guardado por una versión anterior puede no traer los campos nuevos: se rellenan con EMPTY.
const readSnap = async ($: EngineInterface): Promise<Snapshot> => ({ ...EMPTY, ...(await read($, snap)) })
const bump = ($: EngineInterface, fn: (s: Snapshot) => Snapshot) =>
  update($, snap, s => fn({ ...EMPTY, ...s })).catch(() => undefined)
const patch = ($: EngineInterface, p: Partial<Snapshot>) => bump($, s => ({ ...s, ...p }))
const say = async ($: EngineInterface, kind: LogEntry['kind'], line: string) => {
  const at = await $.clock.now()
  await bump($, s => ({ ...s, log: [...s.log, { at, kind, text: line }].slice(-30) }))
}

// Suma el coste de un turno al día de hoy en $.store (compartido entre sesiones) y deja hoy y la semana en el panel.
// ponytail: leer y escribir no es atómico; dos sesiones que acaban turno a la vez pueden perder uno. Un ledger por sesión si importa.
const addHistory = async ($: EngineInterface, usd: number) => {
  const now = await $.clock.now()
  const h = { ...((await $.store.get('history').catch(() => undefined)) as Record<string, number> | undefined) }
  if (usd > 0) {
    h[dayKey(now)] = (h[dayKey(now)] ?? 0) + usd
    const oldest = dayKey(now - 30 * 86_400_000)
    for (const k of Object.keys(h)) if (k < oldest) delete h[k]
    await $.store.set('history', h).catch(() => undefined)
  }
  await patch($, historyTotals(h, now))
}

// Con el panel cerrado, lo esencial en la línea de estado bajo el prompt; abierto, nada (ya se ve).
const refreshStatus = async ($: EngineInterface, isOn: boolean) => {
  if (!isOn) return
  // isPlaced: abierto sin pedirlo en una terminal estrecha, el panel queda en espera sin dibujarse.
  const shown = (await $.ui.panes().catch(() => [])).some(p => p.id === PANE && p.isShown && p.isPlaced)
  $.ui.status(shown ? undefined : statusText(await readSnap($)))
}

// Primer clic: arma el botón; el segundo, antes de CONFIRM_MS, compacta. /compact espera al final del turno.
const pressCompact = async ($: EngineInterface) => {
  const now = await $.clock.now()
  const armed = (await readSnap($)).compactArmed
  if (armed === undefined || now - armed > CONFIRM_MS) {
    await patch($, { compactArmed: now, now })
    $.clock.after(CONFIRM_MS, () => void bump($, s => s.compactArmed === now ? { ...s, compactArmed: undefined } : s))
    return
  }
  await patch($, { compactArmed: undefined })
  await $.command.run({ command: 'compact', args: '' } as never)
    .catch(err => $.ui.toast(`Cabina: ${err instanceof Error ? err.message : String(err)}`))
}

const refreshUsage = async ($: EngineInterface) => {
  // El desglose «summary» es local y gratis: de él sale dónde salta el autocompactado.
  const u = await $.session.usage({ breakdown: 'summary' })
  const b = u.context.breakdown
  await patch($, {
    autoCompactAt: b?.isAutoCompactEnabled ? b.autoCompactThreshold : undefined,
    ctxTokens: u.context.tokens,
    ctxWindow: u.context.window,
    ctxPercent: u.context.percent,
    limits: u.rateLimits,
    costUsd: u.cost?.usd,
    startedAt: u.startedAt,
  })
  return u
}

const openSettings = async ($: EngineInterface) => {
  await update($, view, () => 'settings')
  await $.ui.open({ ...OPEN, focus: true })
}

// Guarda un campo de userConfig como lo haría /config; el motor recarga el mod con el valor nuevo.
// Devuelve el motivo si no se pudo guardar.
const save = async ($: EngineInterface, field: string, value: string | boolean): Promise<string | undefined> => {
  const row = (await $.config.list()).find(r => new RegExp(`^cabina(@[^.]*)?\\.${field}$`).test(r.key))
  if (!row) return `cabina.${field}: not in /config`
  const r = await $.config.set({ key: row.key, value })
  return 'deny' in r && r.deny ? r.deny : undefined
}
const saveOrToast = async ($: EngineInterface, field: string, value: string | boolean) => {
  const deny = await save($, field, value)
  if (deny) void $.ui.toast(deny)
}

// "es", "English", "swahili" → los dos campos de userConfig.
const saveLanguage = async ($: EngineInterface, input: string) => {
  const code = normalize(input)
  if (code === 'auto' || BUILT_IN[code]) return save($, 'language', code)
  return (await save($, 'customLanguage', input.trim())) ?? save($, 'language', 'custom')
}

const git = async ($: EngineInterface, cwd: string, args: string[]) => {
  try {
    const r = await $.process.run(['git', ...args], { cwd, timeoutMs: 3000 })
    return r.exitCode === 0 ? r.stdout : undefined
  } catch {
    return undefined
  }
}

// Rama y cambios sin commitear; fuera de un repositorio, nada.
const gitInfo = async ($: EngineInterface, cwd: string): Promise<Partial<Snapshot>> => {
  const status = await git($, cwd, ['status', '--porcelain'])
  if (status === undefined) return { branch: undefined, git: undefined }
  const branch = (await git($, cwd, ['branch', '--show-current']))?.trim() || undefined
  const changed = status.split('\n').filter(Boolean).length
  return { branch, git: { changed, ...shortstat((await git($, cwd, ['diff', 'HEAD', '--shortstat'])) ?? '') } }
}

// "1.0.10" > "1.0.9": compara número a número; lo que no sea número cuenta como 0.
export const isNewer = (latest: string, current: string) => {
  const a = latest.split('.').map(Number), b = current.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0)
    if (d) return d > 0
  }
  return false
}

const MANIFEST_URL = 'https://raw.githubusercontent.com/SrPirson/cabina/main/.claude-plugin/plugin.json'
const versionOf = (json: string) => {
  const v = (JSON.parse(json) as { version?: unknown }).version
  return typeof v === 'string' ? v : undefined
}

// Versión instalada y la publicada en GitHub; sin red, solo la instalada.
const checkVersion = async ($: EngineInterface) => {
  const version = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`).then(versionOf).catch(() => undefined)
  const r = await $.http.fetch(MANIFEST_URL).catch(() => undefined)
  const latest = r?.ok ? (() => { try { return versionOf(r.text) } catch { return undefined } })() : undefined
  await patch($, { version, latest, updating: undefined })
}

// "cabina@<marketplace>" si se instaló desde un marketplace; con --plugin-dir (@inline) no hay nada que actualizar.
const installedId = async ($: EngineInterface) => {
  const key = (await $.config.list()).find(r => /^cabina@[^.]+\.theme$/.test(r.key))?.key
  const id = key?.slice(0, -'.theme'.length)
  return id && !id.endsWith('@inline') ? id : undefined
}

// Lo mismo que "Update" del README; el motor aplica la versión nueva al reiniciar.
const runUpdate = async ($: EngineInterface) => {
  const s = await readSnap($)
  const id = await installedId($)
  if (!id || s.updating) return
  await patch($, { updating: 'running' })
  const run = (args: string[]) => $.process.run(['claude', 'plugin', ...args], { timeoutMs: 120_000 })
  try {
    const m = await run(['marketplace', 'update', id.split('@')[1]!])
    const r = m.exitCode === 0 ? await run(['update', id]) : m
    if (r.exitCode !== 0) throw new Error((r.stderr || r.stdout).trim().split('\n').pop())
    await patch($, { updating: 'done' })
    void $.ui.toast(fill((await read($, text)).updated, s.latest ?? ''))
  } catch (err) {
    await patch($, { updating: undefined })
    void $.ui.toast(`Cabina: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// Un hook se ve en verde mientras corre y unos segundos después: los de settings suelen durar milisegundos.
export const HOOK_GLOW = 5000

export const register: Register = (on, options) => {
  // Eventos con hooks en settings.json (todas las fuentes, la del proyecto incluida); se relee al dibujar.
  let configured = new Set<string>()
  // Con un plugin gestionado que se salta los classic.* de Cabina, el seguimiento en vivo se apaga solo
  // (track_hooks en /config): queda lo que los hooks escriben en la conversación, al bloquear o añadir contexto.
  const trackHooks = options.track_hooks !== false
  const seenPre = new Set<string>()
  let misses = 0
  const langOption = String(options.language ?? 'auto')
  const customLanguage = String(options.customLanguage ?? '')
  const setting = langOption === 'custom' ? customLanguage || 'auto' : langOption
  const themeId = String(options.theme ?? 'classic')
  const background = String(options.background ?? 'auto')
  // Apartados que el usuario quiere ver (userConfig show_<id>, todos por defecto).
  const SECTION_IDS = ['usage', 'cost', 'activity', 'agents', 'hooks', 'trend', 'files', 'log', 'project'] as const
  const visible = Object.fromEntries(SECTION_IDS.map(id => [id, options[`show_${id}`] !== false])) as
    Record<(typeof SECTION_IDS)[number], boolean>
  const surface = surfaceOf(themeId, background)
  // Presupuesto diario en dólares; vacío o 0, sin presupuesto.
  const budget = Number(String(options.daily_budget ?? '').replace(',', '.')) || 0
  const statusLine = options.status_line !== false
  let lastMode: string | undefined

  on('session.start', async ($, e, next) => {
    void checkVersion($).catch(() => undefined)
    const known = BUILT_IN[normalize(setting)]
    await $.command.register({ name: 'cabina', description: (known ?? BUILT_IN.en!).describe, argumentHint: '[close | config | theme <…> | language <…> | background <…> | help]' })
    void resolveStrings($, setting)
      .then(t => update($, text, () => t))
      .catch(() => undefined)
    const cwd = await $.session.cwd()
    configured = new Set(Object.keys((await $.settings.read({ key: 'hooks' }).catch(() => undefined)) ?? {}))
    const claudeTheme = await $.settings.read({ key: 'theme' }).catch(() => undefined)
    await patch($, { model: await $.session.model(), cwd, ...(await gitInfo($, cwd)), prompts: await $.session.turns(), termLight: typeof claudeTheme === 'string' && claudeTheme.startsWith('light'), now: await $.clock.now() })
    await refreshUsage($)
    // Estado de una versión anterior: lo que se cuenta distinto se empieza de cero.
    // 2: la caché y los modelos se cuentan desde la 1.1.0; con los tokens de antes, el acierto saldría casi a 0.
    if ((await readSnap($)).schema !== 2) {
      await patch($, { schema: 2, ctxTrend: [], costTrend: [], lastTurn: undefined, turnCostStart: undefined, tokIn: 0, tokOut: 0, tokCache: 0, byModel: {} })
    }

    // Reloj: los cronómetros avanzan solos en terminal y escritorio (elapsed.tsx); el panel se redibuja
    // cada segundo solo si un hook está encendido o hay una superficie sin Client (VS Code, móvil). Si no, cada 30 s.
    let tick = 0
    $.clock.every(1000, async () => {
      tick++
      const s = await readSnap($)
      const running = s.busySince !== undefined || s.crew.some(a => a.endedAt === undefined)
      const hooksLive = Object.values(s.hooks).some(h => h.busy || s.now - h.at < 60_000)
      const noClient = running && (await $.session.surfaces().catch(() => [])).some(x => x === 'vscode' || x === 'mobile')
      if (hooksLive || noClient || tick % 30 === 0) await patch($, { now: await $.clock.now() })
      // Ensanchar la terminal coloca el panel sin ningún evento: la línea de estado se revisa cada 5 s.
      if (tick % 5 === 0) await refreshStatus($, statusLine)
    })
    void addHistory($, 0)
    void $.ui.open(OPEN).then(() => refreshStatus($, statusLine)).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'cabina' }, async ($, e) => {
    const t = await read($, text)
    const [sub = '', ...rest] = e.args.trim().split(/\s+/)
    const arg = rest.join(' ')
    if (/^(config|settings|setup|ajustes|configurar)$/i.test(sub)) {
      await openSettings($)
      return { text: `Cabina · ${t.settings}` }
    }
    if (/^(close|closed|hide|cerrar|ocultar|fechar|fermer|schließen|chiudi)$/i.test(sub)) {
      await $.ui.close({ id: PANE })
      await refreshStatus($, statusLine)
      return { text: t.closed }
    }
    if (/^(theme|tema|thème|thema)$/i.test(sub) && arg) {
      const id = arg.toLowerCase().replace(/-light$/, '')
      if (!isThemeId(id)) return { text: `${t.theme}: ${THEME_IDS.join(', ')}` }
      return { text: (await save($, 'theme', id)) ?? `${t.theme}: ${themeName(t, id)}` }
    }
    if (/^(background|bg|fondo|fond|fundo|hintergrund|sfondo)$/i.test(sub) && arg) {
      const word = arg.toLowerCase()
      const mode = /^(dark|oscuro|escuro|sombre|dunkel|scuro)$/.test(word) ? 'dark'
        : /^(light|claro|clair|hell|chiaro)$/.test(word) ? 'light' : 'auto'
      return { text: (await save($, 'background', mode)) ?? `${t.background}: ${mode}` }
    }
    if (/^(language|lang|idioma|langue|sprache|lingua)$/i.test(sub) && arg) {
      return { text: (await saveLanguage($, arg)) ?? `${t.language}: ${arg}` }
    }
    if (sub) {
      return {
        text: [
          '/cabina                  Cabina',
          `/cabina close            ✕ ${t.close}`,
          `/cabina config           ⚙ ${t.settings}`,
          `/cabina theme <…>        ${t.theme}: ${THEME_IDS.join(', ')}`,
          `/cabina language <…>     ${t.language}: auto, ${Object.keys(ENDONYM).join(', ')}, swahili…`,
          `/cabina background <…>   ${t.background}: ${BACKGROUNDS.join(', ')}`,
        ].join('\n'),
      }
    }
    await $.ui.open(OPEN)
    await refreshStatus($, statusLine)
    return { text: (await read($, text)).opened }
  })

  on('session.measure', async ($, e, next) => {
    await patch($, {
      ctxTokens: e.context.tokens,
      ctxWindow: e.context.window,
      ctxPercent: e.context.percent,
      limits: e.rateLimits,
      costUsd: e.cost?.usd,
    })
    await refreshStatus($, statusLine)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      const now = await $.clock.now()
      await bump($, s => ({ ...s, agents: s.agents.includes(id) ? s.agents : [...s.agents, id] }))
      if ((await readSnap($)).crew.some(a => a.id === id)) {
        await touchAgent($, id, a => ({ ...a, endedAt: undefined }))
      } else {
        const info = (await $.agent.list().catch(() => [])).find(a => a.id === id)
        const stat: AgentStat = {
          id, type: info?.type ?? 'agent', desc: info?.description ?? '', parentId: info?.parentId,
          tokens: 0, out: 0, tools: 0, startedAt: now,
        }
        await bump($, s => ({ ...s, crew: [...s.crew.filter(a => a.id !== id), stat].slice(-50) }))
        await say($, 'agent', stat.desc || stat.type)
      }
    } else {
      // En el estado y no en una variable: una recarga del mod a mitad de turno no lo pierde.
      const turnCostStart = (await readSnap($)).costUsd ?? 0
      await patch($, { turnCostStart, busySince: await $.clock.now(), now: await $.clock.now() })
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const isMain = e.agentId === undefined
    if (isMain) {
      await patch($, { model: e.model, effort: e.effort === undefined ? undefined : String(e.effort) })
    }
    // Velocidad del hilo principal: salida entre el primer trozo que no es del motor y el final.
    let firstAt: number | undefined
    const stream = next(e)
    for await (const c of stream) {
      if (isMain && firstAt === undefined && c.kind !== 'engine') firstAt = await $.clock.now()
      yield c
    }
    const r = await stream.result
    const u = r.usage
    if (u) {
      // Total de la sesión: cada petición, del hilo principal y de los agentes.
      const input = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      const secs = firstAt === undefined ? 0 : ((await $.clock.now()) - firstAt) / 1000
      await bump($, s => ({
        ...s,
        tokIn: s.tokIn + input,
        tokOut: s.tokOut + u.output_tokens,
        tokCache: s.tokCache + u.cache_read_input_tokens,
        byModel: { ...s.byModel, [u.model]: (s.byModel[u.model] ?? 0) + input + u.output_tokens },
        // Con menos de medio segundo de salida la cifra no dice nada.
        ...(secs >= 0.5 ? { tokPerSec: u.output_tokens / secs } : {}),
      }))
      // Tokens como los cuenta Claude Code: el contexto de la última petición; la salida, sumada.
      if (e.agentId !== undefined) {
        await touchAgent($, e.agentId, a => ({ ...a, tokens: input + u.output_tokens, out: a.out + u.output_tokens }))
      }
    }
    return r
  })

  on('tool.call', async ($, e, next) => {
    const tool = 'tool' in e ? e.tool : undefined
    const isMain = e.agentId === undefined
    if (isMain) await patch($, { tool })
    try {
      const ran = await next(e)
      // Toda llamada que llega a ejecutarse pasa antes por classic.PreToolUse; si nunca nos llega, nos lo saltan.
      // Tres seguidas, por si alguna llamada no lo dispara (las de $.tool.call de otro plugin).
      if (trackHooks && misses < 3 && !ran.isError && !('deny' in ran && ran.deny)) {
        misses = seenPre.delete(e.tool_use_id) ? 0 : misses + 1
        if (misses === 3) void save($, 'track_hooks', false)
      }
      // Herramientas usadas (también por subagentes) y archivos que se escribieron bien.
      const file = 'file_path' in e && typeof e.file_path === 'string' ? e.file_path
        : 'notebook_path' in e && typeof e.notebook_path === 'string' ? e.notebook_path : undefined
      const isWrite = tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit'
      const deny = 'deny' in ran && ran.deny ? ran.deny : undefined
      const failed = deny !== undefined || ran.isError === true
      const wrote = isWrite && file !== undefined && !failed
      const lines = wrote ? patchStat(ran.result) : { plus: 0, minus: 0 }
      if (tool && e.agentId !== undefined) await touchAgent($, e.agentId, a => ({ ...a, tools: a.tools + 1 }))
      if (tool) {
        await bump($, s => ({
          ...s,
          tools: { ...s.tools, [tool]: (s.tools[tool] ?? 0) + 1 },
          toolErr: failed ? { ...s.toolErr, [tool]: (s.toolErr[tool] ?? 0) + 1 } : s.toolErr,
          files: wrote ? [file, ...s.files.filter(f => f !== file)].slice(0, 20) : s.files,
          linesPlus: s.linesPlus + lines.plus,
          linesMinus: s.linesMinus + lines.minus,
        }))
        if (wrote) await say($, 'edit', relPath(file, (await readSnap($)).cwd))
        else if (failed) {
          const why = (deny ?? ran.text ?? '').trim().split('\n')[0]!.slice(0, 80)
          await say($, deny !== undefined ? 'deny' : 'error', why ? `${tool} · ${why}` : tool)
        }
      }
      return ran
    } finally {
      if (isMain) await patch($, { tool: undefined })
    }
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) {
      const id = e.agentId
      const now = await $.clock.now()
      // Un agente que acaba bien no es rojo: solo el que falla o se interrumpe.
      const failed = e.isAborted || e.reason === 'error'
      await bump($, s => ({ ...s, agents: s.agents.filter(a => a !== id) }))
      await touchAgent($, id, a => ({ ...a, endedAt: now, failed }))
      const a = (await readSnap($)).crew.find(x => x.id === id)
      if (a) await say($, failed ? 'error' : 'done', a.desc || a.type)
      return ran
    }
    const u = await refreshUsage($)
    const s = await readSnap($)
    // Sin el comienzo del turno (no se vio su inicio) no hay coste que atribuirle: no se apunta.
    const turnCost = s.turnCostStart === undefined ? undefined : (u.cost?.usd ?? 0) - s.turnCostStart
    const more = { ...(await gitInfo($, s.cwd)), prompts: await $.session.turns() }
    await bump($, x => ({
      ...x,
      ...more,
      busySince: undefined,
      tool: undefined,
      turnCostStart: undefined,
      ...(turnCost === undefined ? {} : {
        lastTurn: { durationMs: e.durationMs, costUsd: turnCost, tokPerSec: x.tokPerSec },
        ctxTrend: pushTrend(x.ctxTrend, u.context.percent ?? 0),
        costTrend: pushTrend(x.costTrend, turnCost),
      }),
    }))
    if (turnCost !== undefined) await addHistory($, turnCost)
    await refreshStatus($, statusLine)
    return ran
  })

  on('session.compact', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined) {
      await bump($, s => ({ ...s, compactions: s.compactions + 1 }))
      await say($, 'compact', '')
    }
    return ran
  })

  // /clear empieza otra sesión en el mismo proceso: el panel también.
  on('session.end', async ($, e, next) => {
    const ran = await next(e)
    if (e.reason === 'clear') {
      await patch($, CLEARED)
      await refreshUsage($).catch(() => undefined)
    }
    return ran
  })

  // Los hooks de settings van debajo de los módulos en la cadena: lo que tarda next es lo que tardan ellos.
  on('classic.*', async ($, e, next) => {
    // Cualquier evento clásico trae el modo de permisos (plan, acceptEdits…); se apunta cuando cambia.
    const mode = 'permission_mode' in e && typeof e.permission_mode === 'string' ? e.permission_mode : undefined
    if (mode && mode !== lastMode) {
      lastMode = mode
      await patch($, { permissionMode: mode })
    }
    if (!trackHooks) return next(e)
    const event = next.event.slice('classic.'.length)
    if (event === 'PreToolUse' && 'tool_use_id' in e) seenPre.add(e.tool_use_id)
    if (!configured.has(event)) return next(e)
    const detail = 'tool' in e ? e.tool : 'tool_name' in e ? e.tool_name : undefined
    const mark = async (busy: boolean, blocked = false) => {
      const at = await $.clock.now()
      await bump($, s => ({ ...s, now: at, hooks: { ...s.hooks, [event]: { at, busy, blocked, detail } } }))
      if (blocked) await say($, 'hook', detail ? `${event} · ${detail}` : event)
    }
    await mark(true)
    try {
      const ran = await next(e)
      const r = ran as { block?: string; deny?: string } | undefined
      await mark(false, Boolean(r?.block || r?.deny))
      return ran
    } catch (err) {
      await mark(false)
      throw err
    }
  })

  // Lo que un hook de settings devuelve (un bloqueo, contexto) entra en la conversación con su evento.
  on('session.append', async ($, e, next) => {
    const ran = await next(e)
    if (e.origin.kind === 'hook') {
      const event = e.origin.event
      const at = await $.clock.now()
      const blocked = /block|stop|error/i.test(e.message.name ?? '')
      await bump($, s => ({ ...s, now: at, hooks: { ...s.hooks, [event]: { at, busy: false, blocked, detail: s.hooks[event]?.detail } } }))
      // Con seguimiento en vivo, el bloqueo ya lo apuntó classic.*.
      if (blocked && !trackHooks) await say($, 'hook', event)
    }
    return ran
  })

  // La vista principal cabe siempre en el panel: la rueda mueve la lista de agentes cuando no caben.
  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const max = Math.max(0, (await readSnap($)).crew.length - CREW_ROWS)
    if (max === 0 || (await read($, view)) === 'settings') return next(e)
    await update($, crewBack, b => Math.min(max, Math.max(0, b - e.by))).catch(() => undefined)
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // Ajustes: otra vista del mismo panel. Un segundo panel se abría como pestaña oculta.
    if ((await read($, view)) === 'settings') {
      const ui = $.ui.resolve(e)
      const { Box, Text, Button } = ui
      const t = await read($, text)
      const languages = [
        { value: 'auto', label: t.auto },
        ...Object.entries(ENDONYM).map(([value, label]) => ({ value, label })),
        { value: 'custom', label: `${t.other}…` },
      ]
      const themes = THEME_IDS.map(id => ({ value: id, label: themeName(t, id) }))
      const snapMode = await readSnap($)
      const sectionName = { usage: t.secUsage, cost: t.secCost, activity: t.secActivity, agents: t.secAgents, hooks: t.secHooks, trend: t.secTrend, files: t.files, log: t.secLog, project: t.secProject }
      // Elegir un apartado lo muestra u oculta; la marca dice cómo está ahora.
      const sections = SECTION_IDS.map(id => ({ value: id, label: `${visible[id] ? '✓' : '○'} ${sectionName[id]}` }))
      const toggle = (id: string) => {
        if (id in visible) void saveOrToast($, `show_${id}`, !visible[id as keyof typeof visible])
      }
      const backgrounds = [
        { value: 'auto', label: t.bgAuto },
        { value: 'dark', label: t.bgDark },
        { value: 'light', label: t.bgLight },
      ]
      const swatch = (id: string) => {
        const th = themeOf(id, surface?.mode ?? (snapMode.termLight ? 'light' : 'dark'), surface !== undefined)
        return (
          <Text>
            <Text color={th.ok}>━━━</Text>
            <Text color={th.warn}>━━━</Text>
            <Text color={th.danger}>━━━</Text>
            <Text color={th.accent}>━━━</Text>
          </Text>
        )
      }

      // Terminal, escritorio y VS Code: listas que se recorren con ↑↓ y se eligen con Enter.
      // Móvil no tiene Select ni Input: una lista de botones, uno por fila.
      const body =
        'Select' in ui && e.surface !== 'mobile' ? (
          <Box flexDirection="column" gap={1}>
            <Text dimColor>{t.hint}</Text>
            <ui.Select key="language" label={t.language} options={languages} value={langOption} autoFocus
              onSelect={value => void saveOrToast($, 'language', value)} />
            {langOption === 'custom' && 'Input' in ui && (
              <ui.Input key="custom" label={t.other} placeholder={t.otherHint} value={customLanguage}
                autoFocus={customLanguage ? undefined : true}
                onSubmit={async value => {
                  const deny = await saveLanguage($, value.trim() || 'auto')
                  if (deny) void $.ui.toast(deny)
                }} />
            )}
            <ui.Select key="theme" label={t.theme} options={themes} value={themeId}
              onSelect={value => void saveOrToast($, 'theme', value)} />
            <ui.Select key="background" label={t.background} options={backgrounds} value={background}
              onSelect={value => void saveOrToast($, 'background', value)} />
            <ui.Select key="sections" label={t.sections} options={sections} onSelect={toggle} />
            {swatch(themeId)}
          </Box>
        ) : (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
              <Text bold>{t.language}</Text>
              {languages.filter(l => l.value !== 'custom').map(l => (
                <Button key={`lang-${l.value}`} plain onPress={() => void saveOrToast($, 'language', l.value)}>
                  {`${l.value === langOption ? '●' : '○'} ${l.label}`}
                </Button>
              ))}
            </Box>
            <Box flexDirection="column">
              <Text bold>{t.theme}</Text>
              {themes.map(th => (
                <Button key={`theme-${th.value}`} plain onPress={() => void saveOrToast($, 'theme', th.value)}>
                  {`${th.value === themeId ? '●' : '○'} ${th.label}`}
                </Button>
              ))}
            </Box>
            <Box flexDirection="column">
              <Text bold>{t.background}</Text>
              {backgrounds.map(b => (
                <Button key={`bg-${b.value}`} plain onPress={() => void saveOrToast($, 'background', b.value)}>
                  {`${b.value === background ? '●' : '○'} ${b.label}`}
                </Button>
              ))}
            </Box>
            <Box flexDirection="column">
              <Text bold>{t.sections}</Text>
              {sections.map(sec => (
                <Button key={`sec-${sec.value}`} plain onPress={() => toggle(sec.value)}>{sec.label}</Button>
              ))}
            </Box>
          </Box>
        )

      return (
        <Box flexDirection="column" gap={1}>
          {body}
          <Button key="close" label={t.close} onPress={() => void update($, view, () => 'main')} />
        </Box>
      )
    }

    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const s = await readSnap($)
    // /model no abre turno, y classic.PostModelSwitch no llega aquí en cuentas
    // con ajustes gestionados (cc-plugin-sec-default se lo queda): se lee en vivo.
    const liveModel = await $.session.model().catch(() => s.model)
    // /effort tampoco abre turno; lo guarda por modelo en modelSettings.<id>.effortLevel.
    const settings = await $.settings.read({}).catch(() => undefined)
    if (settings) configured = new Set(Object.keys(settings.hooks ?? {}))
    const perModel = (settings?.modelSettings as Record<string, { effortLevel?: unknown }> | undefined)?.[liveModel.replace(/\[.*\]$/, '')]
    const liveEffort = perModel?.effortLevel !== undefined ? String(perModel.effortLevel)
      : liveModel === s.model ? s.effort : undefined
    const fg = surface?.fg
    const muted = surface?.muted ?? 'inactive'
    // Texto secundario: gris con contraste medido sobre un fondo pintado; atenuado sobre el de la terminal.
    const dim = surface ? { color: surface.sub } : { dimColor: true as const }
    const theme = themeOf(themeId, surface?.mode ?? (s.termLight ? 'light' : 'dark'), surface !== undefined)
    const t = await read($, text)
    const limitLabel: Record<string, string> = { five_hour: t.h5, seven_day: t.d7, spend_limit: t.spend }
    const lastLabel = t.last.charAt(0).toUpperCase() + t.last.slice(1)
    const labels = [t.context, t.cost, t.agents, t.total, lastLabel, t.duration, t.tools, t.today, t.models, ...Object.values(limitLabel)]
    const labelWidth = Math.min(12, 1 + Math.max(...labels.map(x => x.length)))
    const cols = e.props.bodyColumns - (surface ? 2 : 0)
    const barWidth = Math.max(6, Math.min(20, cols - 18 - labelWidth))

    // Cronómetro: en terminal y escritorio avanza solo (elapsed.tsx) sin redibujar el panel.
    const hasClient = 'Client' in els && (e.surface === 'terminal' || e.surface === 'desktop')
    const clock = (key: string, since: number, color?: string) => hasClient
      // Un Client no admite props undefined: sin color, la clave no va.
      ? <els.Client key={key} module="./elapsed.tsx"
        props={{ since, now: s.now, dim: !color && !surface, ...((color ?? surface?.sub) ? { color: color ?? surface?.sub } : {}) }} />
      : <Text color={color} {...(color ? {} : dim)}>{span(s.now - since)}</Text>

    // Cabecera de cada apartado: nombre en el color de acento y una regla hasta el borde.
    const section = (title: string, right = '') => {
      const name = title.toUpperCase()
      const rule = Math.max(2, cols - name.length - (right ? right.length + 2 : 1))
      return (
        <Text color={fg} wrap="truncate">
          <Text color={theme.accent} bold>{name}</Text>
          <Text color={muted}>{` ${'─'.repeat(rule)}`}</Text>
          {right && <Text {...dim}>{` ${right}`}</Text>}
        </Text>
      )
    }

    // Barra con una marca opcional (◆ ritmo uniforme, ┃ autocompactado); las celdas seguidas del mismo color van juntas.
    const gauge = (label: string, pct: number, right: string, mark?: { at: number; glyph: string }) => {
      const full = Math.round((Math.min(100, Math.max(0, pct)) / 100) * barWidth)
      const markAt = mark ? Math.min(barWidth - 1, Math.max(0, Math.floor((mark.at / 100) * barWidth))) : -1
      const runs: [string, string | undefined][] = []
      for (let i = 0; i < barWidth; i++) {
        const [ch, color] = i === markAt ? [mark!.glyph, fg] : ['━', i < full ? toneOf(theme, pct) : muted]
        const last = runs[runs.length - 1]
        if (last && last[1] === color) last[0] += ch
        else runs.push([ch, color])
      }
      return (
        <Box flexDirection="row" gap={1}>
          <Box width={labelWidth}><Text {...dim} wrap="truncate">{label}</Text></Box>
          <Text color={fg}>{runs.map(([ch, color], i) => <Text key={`${i}`} color={color} bold={ch !== '━'}>{ch}</Text>)}</Text>
          <Box width={4} justifyContent="flex-end"><Text color={fg} bold>{`${Math.round(pct)}%`}</Text></Box>
          <Text {...dim} wrap="truncate">{right}</Text>
        </Box>
      )
    }

    const busy = s.busySince !== undefined
    const ctx = s.ctxPercent ?? 0
    const row = (label: string, children: JSX.Element) => (
      <Box flexDirection="row" gap={1}>
        <Box width={labelWidth}><Text {...dim} wrap="truncate">{label}</Text></Box>
        {children}
      </Box>
    )

    const header = (
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Box flexShrink={1}>
          <Text color={fg} wrap="truncate">
            <Text color={busy ? theme.accent : muted}>● </Text>
            <Text color={fg} bold>{prettyModel(liveModel) || '—'}</Text>
            {liveEffort && <Text {...dim}>{` · ${liveEffort}`}</Text>}
            {s.permissionMode && s.permissionMode !== 'default' && <Text color={theme.warn}>{` · ${s.permissionMode}`}</Text>}
          </Text>
        </Box>
        {busy ? (
          <Box flexDirection="row" flexShrink={0}>
            {s.tool && <Text color={theme.accent}>{`${s.tool} · `}</Text>}
            {clock('busy', s.busySince ?? s.now, theme.accent)}
          </Box>
        ) : <Text color={muted}>{t.idle}</Text>}
      </Box>
    )

    // Contexto: lo que falta para el autocompactado, con su marca en la barra.
    const compactLeft = s.autoCompactAt !== undefined && s.ctxTokens !== undefined ? s.autoCompactAt - s.ctxTokens : undefined
    const ctxGauge = gauge(
      t.context,
      ctx,
      // Con autocompactado, lo que falta para él (`410k ⟲425k`); el % ya dice cuánto es de la ventana.
      compactLeft !== undefined && compactLeft > 0 ? `${tokens(s.ctxTokens ?? 0)} ⟲${tokens(compactLeft)}`
        : s.ctxWindow ? `${tokens(s.ctxTokens ?? 0)}/${tokens(s.ctxWindow)}` : '',
      s.autoCompactAt !== undefined && s.ctxWindow ? { at: (s.autoCompactAt / s.ctxWindow) * 100, glyph: '┃' } : undefined,
    )
    const limitGauge = (l: (typeof s.limits)[number]) => {
      const p = pace(l, s.now)
      return gauge(
        limitLabel[l.kind] ?? l.kind,
        l.percentUsed,
        l.resetsAt ? `↻ ${span(Date.parse(l.resetsAt) - s.now)}` : '',
        p && { at: p.expected, glyph: '◆' },
      )
    }

    // Encima del prompt (fuera de pantalla completa) no hay sitio: un resumen de 8 filas como mucho.
    if (e.props.placement === 'inline') {
      return (
        <Box flexDirection="column">
          {header}
          {ctxGauge}
          {s.limits.map(limitGauge)}
          <Text {...dim} wrap="truncate">
            {[s.costUsd === undefined ? '' : `$${s.costUsd.toFixed(2)}`, s.lastTurn ? `+$${s.lastTurn.costUsd.toFixed(2)}` : '', s.branch ? `⎇ ${s.branch}` : '']
              .filter(Boolean).join(' · ')}
          </Text>
        </Box>
      )
    }

    // Apartados fijos: estado, consumo, coste y proyecto. Los demás, por prioridad, solo si caben
    // (cada uno cuenta su cabecera y el hueco que lo separa).
    const showCompact = ctx >= 70 || s.compactions > 0
    const hasChanges = s.git !== undefined && s.git.changed > 0
    const runsOut = s.limits.map(l => pace(l, s.now)?.runsOutIn)
    const models = Object.entries(
      Object.entries(s.byModel).reduce<Record<string, number>>((m, [id, n]) => ({ ...m, [modelFamily(id)]: (m[modelFamily(id)] ?? 0) + n }), {}),
    ).sort((a, b) => b[1] - a[1])
    const baseRows = 2
      + (visible.usage ? 2 + s.limits.length + runsOut.filter(Boolean).length + (showCompact ? 1 : 0) : 0)
      + (visible.cost ? 3 + (s.lastTurn ? 1 : 0) + (s.tokIn ? 1 : 0) + (s.today !== undefined ? 1 : 0) + (models.length > 1 ? 1 : 0) : 0)
      + (visible.project ? 3 + (hasChanges ? 1 : 0) : 2)
    const files = s.files.slice(0, 4)
    const topTools = Object.entries(s.tools).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const trendLen = Math.min(s.ctxTrend.length, barWidth + 8)
    // Una ventana de CREW_ROWS que la rueda mueve (ui.scroll); los que no caben se cuentan en la cabecera.
    const back = Math.min(await read($, crewBack), Math.max(0, s.crew.length - CREW_ROWS))
    const crew = s.crew.slice(Math.max(0, s.crew.length - CREW_ROWS - back), s.crew.length - back)
    // Sin seguimiento en vivo, solo los eventos de los que ya llegó algo: los demás se quedarían en gris.
    const hookEvents = trackHooks ? [...configured] : Object.keys(s.hooks)
    const log = s.log.slice(-LOG_ROWS)
    const wanted = {
      agents: crew.length ? 1 + crew.length : 0,
      hooks: hookEvents.length ? 1 + hookEvents.length : 0,
      files: files.length ? 2 + files.length : 0,
      activity: s.startedAt !== undefined ? 3 + (topTools.length ? 1 : 0) + (s.agents.length ? 1 : 0) : 0,
      trend: trendLen >= 3 ? 5 : 0,
      log: log.length ? 2 + log.length : 0,
    }
    let room = e.props.scroll.bodyRows - baseRows
    const fits = (rows: number) => {
      if (rows <= 0 || rows > room) return false
      room -= rows
      return true
    }
    const show = {
      files: visible.files && fits(wanted.files),
      activity: visible.activity && fits(wanted.activity),
      agents: visible.agents && fits(wanted.agents),
      hooks: visible.hooks && fits(wanted.hooks),
      trend: visible.trend && fits(wanted.trend),
      log: visible.log && fits(wanted.log),
    }

    const elapsed = s.startedAt !== undefined ? s.now - s.startedAt : 0
    const perHour = s.costUsd !== undefined && elapsed > 5 * 60_000 ? s.costUsd / (elapsed / 3_600_000) : undefined
    const costMax = Math.max(...s.costTrend.slice(-trendLen), 0)
    const cacheHit = s.tokIn > 0 ? Math.round((s.tokCache / s.tokIn) * 100) : undefined
    const logMark: Record<LogEntry['kind'], [string, string]> = {
      edit: ['+', theme.ok], error: ['✗', theme.danger], deny: ['⊘', theme.warn],
      agent: ['▸', theme.accent], done: ['✓', theme.ok], compact: ['⟲', theme.accent], hook: ['!', theme.danger],
    }

    // Esquina de ajustes: la versión, discreta; si hay una más nueva, un botón que la instala.
    const hasUpdate = s.version !== undefined && s.latest !== undefined && isNewer(s.latest, s.version)
    const corner = (
      <Box flexDirection="row" gap={1} flexShrink={0}>
        {hasUpdate && !s.updating ? (
          <Button key="update" plain onPress={() => void runUpdate($)}>
            <Text color={theme.accent} bold>{`↑ v${s.latest}`}</Text>
          </Button>
        ) : s.version && (
          <Text {...dim}>{hasUpdate ? `${s.updating === 'done' ? '✓' : '↻'} v${s.latest}` : `v${s.version}`}</Text>
        )}
        <Button key="settings" plain onPress={() => void openSettings($)}>
          <Text {...dim}>{`⚙ ${t.settings}`}</Text>
        </Button>
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1} backgroundColor={surface?.bg} paddingX={surface ? 1 : 0}
        minHeight={surface ? e.props.scroll.bodyRows : undefined}>
        {header}

        {visible.usage && <Box flexDirection="column">
          {section(t.secUsage)}
          {ctxGauge}
          {s.limits.map((l, i) => (
            <Box key={l.kind} flexDirection="column">
              {limitGauge(l)}
              {runsOut[i] !== undefined && row('', <Text color={theme.warn} wrap="truncate">{`▲ ${fill(t.runsOut, span(runsOut[i]!))}`}</Text>)}
            </Box>
          ))}
          {showCompact && (
            <Box flexDirection="row" gap={1}>
              {ctx >= 70 && (
                <Button key="compact" label={s.compactArmed !== undefined ? t.confirm : t.compact}
                  variant={ctx >= 85 || s.compactArmed !== undefined ? 'primary' : undefined}
                  onPress={() => void pressCompact($)} />
              )}
              {s.compactions > 0 && <Text {...dim}>{fill(t.compacted, s.compactions)}</Text>}
            </Box>
          )}
        </Box>}

        {visible.cost && <Box flexDirection="column">
          {section(t.secCost)}
          {row(t.total, (
            <Text color={fg} wrap="truncate">
              <Text color={fg} bold>{s.costUsd === undefined ? '—' : `$${s.costUsd.toFixed(2)}`}</Text>
              {perHour !== undefined && <Text {...dim}>{` · $${perHour.toFixed(2)}/h`}</Text>}
            </Text>
          ))}
          {s.today !== undefined && (budget > 0
            ? gauge(t.today, (s.today / budget) * 100, `$${s.today.toFixed(2)}/$${budget} · ${t.d7} $${(s.week ?? 0).toFixed(2)}`)
            : row(t.today, (
              <Text color={fg} wrap="truncate">
                {`$${s.today.toFixed(2)}`}
                <Text {...dim}>{` · ${t.d7} $${(s.week ?? 0).toFixed(2)}`}</Text>
              </Text>
            )))}
          {s.lastTurn && row(lastLabel, (
            <Text {...dim} wrap="truncate">
              {[`+$${s.lastTurn.costUsd.toFixed(2)}`, span(s.lastTurn.durationMs), s.lastTurn.tokPerSec ? `${Math.round(s.lastTurn.tokPerSec)} tok/s` : '']
                .filter(Boolean).join(' · ')}
            </Text>
          ))}
          {s.tokIn > 0 && row('Tokens', (
            <Text {...dim} wrap="truncate">
              {`${tokens(s.tokIn)} · ↓ ${tokens(s.tokOut)}${cacheHit !== undefined ? ` · ${t.cache} ${cacheHit}%` : ''}`}
            </Text>
          ))}
          {models.length > 1 && row(t.models, (
            <Text {...dim} wrap="truncate">{models.map(([name, n]) => `${name} ${tokens(n)}`).join(' · ')}</Text>
          ))}
        </Box>}

        {show.activity && (
          <Box flexDirection="column">
            {section(t.secActivity)}
            {row(t.duration, (
              <Text color={fg} wrap="truncate">
                {span(elapsed)}
                <Text {...dim}>{` · ${fill(t.prompts, s.prompts)}`}</Text>
              </Text>
            ))}
            {topTools.length > 0 && row(t.tools, (
              <Text color={fg} wrap="truncate">
                {topTools.map(([name, n], i) => (
                  <Text key={name} color={fg}>
                    {`${i > 0 ? ' · ' : ''}${name} ${n}`}
                    {s.toolErr[name] ? <Text color={theme.danger}>{` ✗${s.toolErr[name]}`}</Text> : null}
                  </Text>
                ))}
              </Text>
            ))}
            {s.agents.length > 0 && row(t.agents, (
              <Text color={theme.accent}>{fill(t.running, s.agents.length)}</Text>
            ))}
          </Box>
        )}

        {show.agents && (
          <Box flexDirection="column">
            {section(t.secAgents, `${s.crew.length > CREW_ROWS ? '↕ ' : ''}${s.crew.length} · ↓ ${tokens(s.crew.reduce((n, a) => n + a.out, 0))}`)}
            {crew.map(a => {
              const running = a.endedAt === undefined
              const nested = a.parentId !== undefined && s.crew.some(p => p.id === a.parentId)
              // En curso ●, terminado ✓ atenuado, fallido o parado ✗ en rojo.
              const [glyph, color] = running ? ['●', theme.ok] : a.failed ? ['✗', theme.danger] : ['✓', muted]
              return (
                <Box key={a.id} flexDirection="row" justifyContent="space-between" gap={1}>
                  <Box flexShrink={1}>
                    <Text color={fg} wrap="truncate">
                      <Text color={color}>{nested ? `└${glyph} ` : `${glyph} `}</Text>
                      {running || a.failed ? <Text color={fg}>{a.desc || a.type}</Text> : <Text {...dim}>{a.desc || a.type}</Text>}
                    </Text>
                  </Box>
                  {/* Sin fragmentos: el motor los dibuja como una caja en columna y el tiempo bajaría de línea. */}
                  <Box flexDirection="row" flexShrink={0}>
                    {running && <Text {...dim}>{`${tokens(a.tokens)} · ↓ ${tokens(a.out)} · `}</Text>}
                    {running && clock(`agent-${a.id}`, a.startedAt)}
                    {!running && <Text {...dim}>{agentUsage(a, s.now)}</Text>}
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}

        {show.hooks && (
          <Box flexDirection="column">
            {section(t.secHooks, `${hookEvents.length}`)}
            {hookEvents.map(name => {
              const hook = s.hooks[name]
              const lit = hook !== undefined && (hook.busy || s.now - hook.at < HOOK_GLOW)
              const state = !hook ? '—' : hook.busy ? '…' : `${hook.blocked ? `${t.blocked} · ` : ''}${fill(t.ago, span(s.now - hook.at))}`
              return (
                <Box key={name} flexDirection="row" justifyContent="space-between" gap={1}>
                  <Box flexShrink={1}>
                    <Text color={fg} wrap="truncate">
                      <Text color={hook?.blocked ? theme.danger : lit ? theme.ok : muted}>● </Text>
                      <Text color={fg}>{name}</Text>
                      {hook?.detail && <Text {...dim}>{` · ${hook.detail}`}</Text>}
                    </Text>
                  </Box>
                  <Box flexShrink={0}>
                    <Text {...dim}>{state}</Text>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}

        {show.trend && (
          <Box flexDirection="column">
            {section(fill(t.trend, trendLen))}
            {/* Una línea entre las dos barras: si no, los bloques de una tocan los de la otra. */}
            <Box flexDirection="column" gap={1}>
              {row(t.context, <Text color={toneOf(theme, ctx)}>{spark(s.ctxTrend.slice(-trendLen), 100)}</Text>)}
              {row(t.cost, (
                <Text color={fg}>
                  <Text color={theme.accent}>{spark(s.costTrend.slice(-trendLen))}</Text>
                  <Text {...dim}>{` ≤ $${costMax.toFixed(2)}`}</Text>
                </Text>
              ))}
            </Box>
          </Box>
        )}

        {show.files && (
          <Box flexDirection="column">
            {section(t.files, [fill(t.edited, s.files.length), s.linesPlus || s.linesMinus ? `+${s.linesPlus} −${s.linesMinus}` : ''].filter(Boolean).join(' · '))}
            {files.map(f => (
              // Los de fuera del proyecto (relPath no los acorta) van atenuados.
              relPath(f, s.cwd) === f.replace(/\\/g, '/')
                ? <Text {...dim} wrap="truncate-start">{f.replace(/\\/g, '/')}</Text>
                : <Text color={fg} wrap="truncate-start">{relPath(f, s.cwd)}</Text>
            ))}
          </Box>
        )}

        {show.log && (
          <Box flexDirection="column">
            {section(t.secLog)}
            {log.map((l, i) => {
              const [glyph, color] = logMark[l.kind]
              return (
                <Box key={`${l.at}-${i}`} flexDirection="row" justifyContent="space-between" gap={1}>
                  <Box flexShrink={1}>
                    <Text color={fg} wrap="truncate">
                      <Text color={color}>{`${glyph} `}</Text>
                      {l.kind === 'compact' ? fill(t.compacted, s.compactions) : l.text}
                    </Text>
                  </Box>
                  <Box flexShrink={0}><Text {...dim}>{fill(t.ago, span(s.now - l.at))}</Text></Box>
                </Box>
              )
            })}
          </Box>
        )}

        {visible.project ? <Box flexDirection="column">
          {section(t.secProject)}
          <Box flexDirection="row" justifyContent="space-between" gap={1}>
            <Box flexShrink={1}>
              <Text color={fg} wrap="truncate-start">
                {shortPath(s.cwd)}
                {s.branch && <Text color={theme.branch}>{`  ⎇ ${s.branch}`}</Text>}
              </Text>
            </Box>
            {corner}
          </Box>
          {hasChanges && s.git && (
            <Text color={fg} wrap="truncate">
              <Text color={theme.ok}>{`+${s.git.plus}`}</Text>
              <Text color={theme.danger}>{` −${s.git.minus}`}</Text>
              <Text {...dim}>{` · ${fill(t.uncommitted, s.git.changed)}`}</Text>
            </Text>
          )}
        </Box> : (
          // Sin «Proyecto», el botón de ajustes se queda solo: siempre hay forma de volver.
          <Box flexDirection="row" justifyContent="flex-end">{corner}</Box>
        )}
      </Box>
    )
  })
}

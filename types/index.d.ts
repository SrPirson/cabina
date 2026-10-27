export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

// Un subagente (o compañero de equipo) de la sesión y lo que lleva gastado.
export type AgentStat = {
  id: string
  type: string
  desc: string
  parentId?: string
  tokens: number
  out: number
  tools: number
  startedAt: number
  endedAt?: number
  // Terminó con error o lo pararon (un agente terminado bien no es rojo).
  failed?: boolean
}

// Una línea del registro: lo que ha pasado, lo más reciente al final.
export type LogEntry = { at: number; kind: 'edit' | 'error' | 'deny' | 'agent' | 'done' | 'compact' | 'hook'; text: string }

// Último disparo de un evento con hooks en settings.json (PreToolUse, Stop…).
export type HookStat = { at: number; busy: boolean; blocked: boolean; detail?: string }

export type Snapshot = {
  model: string
  effort?: string
  ctxTokens?: number
  ctxWindow: number
  ctxPercent?: number
  limits: RateLimit[]
  costUsd?: number
  compactions: number
  busySince?: number
  tool?: string
  agents: string[]
  crew: AgentStat[]
  hooks: Record<string, HookStat>
  lastTurn?: { durationMs: number; costUsd: number; tokPerSec?: number }
  cwd: string
  branch?: string
  git?: { changed: number; plus: number; minus: number }
  files: string[]
  tools: Record<string, number>
  // Llamadas que fallaron o se denegaron, por herramienta.
  toolErr: Record<string, number>
  // Líneas que Claude ha escrito con Edit/Write en la sesión.
  linesPlus: number
  linesMinus: number
  prompts: number
  startedAt?: number
  ctxTrend: number[]
  costTrend: number[]
  // Tokens de toda la sesión (agentes incluidos): entrada con caché y salida.
  tokIn: number
  tokOut: number
  // De tokIn, los leídos de la caché: el acierto de caché es tokCache / tokIn.
  tokCache: number
  // Salida por modelo ("claude-haiku-5-5" → tokens).
  byModel: Record<string, number>
  // Tokens a los que salta el autocompactado; sin él, nada.
  autoCompactAt?: number
  permissionMode?: string
  // Velocidad de la última respuesta del hilo principal.
  tokPerSec?: number
  // Coste de hoy y de los últimos 7 días, de todas las sesiones (historial en $.store).
  today?: number
  week?: number
  log: LogEntry[]
  // Primer clic en compactar: el segundo, antes de 5 s, lo confirma.
  compactArmed?: number
  termLight?: boolean
  turnCostStart?: number
  schema?: number
  version?: string
  latest?: string
  updating?: 'running' | 'done'
  now: number
}

export type Strings = {
  context: string; h5: string; d7: string; spend: string; cost: string; last: string
  agents: string; running: string; idle: string; compact: string; compacted: string
  opened: string; closed: string; describe: string
  settings: string; language: string; theme: string; auto: string; other: string; otherHint: string; close: string; hint: string
  session: string; prompts: string; tools: string; trend: string; files: string; uncommitted: string; clean: string
  background: string; bgAuto: string; bgDark: string; bgLight: string
  secUsage: string; secCost: string; secActivity: string; secProject: string; total: string; duration: string; edited: string
  sections: string; secTrend: string; secAgents: string; secHooks: string; blocked: string; ago: string
  tClassic: string; tColorblind: string; tContrast: string; tMono: string
  updated: string
  runsOut: string; confirm: string; today: string; secLog: string; models: string; cache: string
}

declare module 'claude-code' {
  interface PluginState {
    cabina: { snap: Snapshot; text: Strings; view: 'main' | 'settings'; crewBack: number }
  }
}

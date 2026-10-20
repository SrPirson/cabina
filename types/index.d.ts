export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

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
  lastTurn?: { durationMs: number; costUsd: number }
  cwd: string
  branch?: string
  git?: { changed: number; plus: number; minus: number }
  files: string[]
  tools: Record<string, number>
  prompts: number
  startedAt?: number
  ctxTrend: number[]
  costTrend: number[]
  termLight?: boolean
  turnCostStart?: number
  schema?: number
  now: number
}

export type Strings = {
  context: string; h5: string; d7: string; spend: string; cost: string; last: string
  agents: string; running: string; idle: string; compact: string; compacted: string
  opened: string; describe: string
  settings: string; language: string; theme: string; auto: string; other: string; otherHint: string; close: string; hint: string
  session: string; prompts: string; tools: string; trend: string; files: string; uncommitted: string; clean: string
  background: string; bgAuto: string; bgDark: string; bgLight: string
  secUsage: string; secCost: string; secActivity: string; secProject: string; total: string; duration: string; edited: string
  sections: string; secTrend: string
  tClassic: string; tColorblind: string; tContrast: string; tMono: string
}

declare module 'claude-code' {
  interface PluginState {
    cabina: { snap: Snapshot; text: Strings; view: 'main' | 'settings' }
  }
}

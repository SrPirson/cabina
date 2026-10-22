import type { Strings } from '../types'

const en: Strings = {
  context: 'Context', h5: '5 hours', d7: '7 days', spend: 'Spend', cost: 'Cost', last: 'last',
  agents: 'Agents', running: '{n} running', idle: 'idle', compact: 'compact', compacted: '{n}× compacted',
  opened: 'Cabina pane opened.', closed: 'Cabina pane closed.', describe: 'Open the Cabina pane (config: settings)',
  settings: 'Settings', language: 'Language', theme: 'Theme', auto: 'Automatic', other: 'Other language',
  otherHint: 'name or code, e.g. swahili', close: 'close', hint: '↑↓ choose · Enter save · Tab next · Esc close',
  session: 'Session', prompts: '{n} prompts', tools: 'Tools', trend: 'Trend · {n} turns', files: 'Files', uncommitted: '{n} uncommitted', clean: 'clean',
  background: 'Background', bgAuto: 'Terminal', bgDark: 'Dark', bgLight: 'Light',
  secUsage: 'Usage', secCost: 'Cost', secActivity: 'Activity', secProject: 'Project', total: 'Total', duration: 'Duration', edited: '{n} edited',
  sections: 'Sections', secTrend: 'Trend', secAgents: 'Agents', secHooks: 'Hooks', blocked: 'blocked', ago: '{n} ago',
  tClassic: 'Classic', tColorblind: 'Colour-blind safe', tContrast: 'High contrast', tMono: 'Monochrome',
  updated: 'Updated to v{n} · restart Claude Code to apply',
}

export const BUILT_IN: Record<string, Strings> = {
  en,
  es: {
    context: 'Contexto', h5: '5 horas', d7: '7 días', spend: 'Gasto', cost: 'Coste', last: 'último',
    agents: 'Agentes', running: '{n} en curso', idle: 'en espera', compact: 'compactar', compacted: '{n}× compactado',
    opened: 'Panel Cabina abierto.', closed: 'Panel Cabina cerrado.', describe: 'Abre el panel Cabina (config: ajustes)',
    settings: 'Ajustes', language: 'Idioma', theme: 'Tema', auto: 'Automático', other: 'Otro idioma',
    otherHint: 'nombre o código, p. ej. swahili', close: 'cerrar', hint: '↑↓ elegir · Enter guardar · Tab siguiente · Esc cerrar',
    session: 'Sesión', prompts: '{n} prompts', tools: 'Herram.', trend: 'Tendencia · {n} turnos', files: 'Archivos', uncommitted: '{n} sin commitear', clean: 'sin cambios',
    background: 'Fondo', bgAuto: 'Terminal', bgDark: 'Oscuro', bgLight: 'Claro',
    secUsage: 'Consumo', secCost: 'Coste', secActivity: 'Actividad', secProject: 'Proyecto', total: 'Total', duration: 'Duración', edited: '{n} editados',
    sections: 'Apartados', secTrend: 'Tendencia', secAgents: 'Agentes', secHooks: 'Hooks', blocked: 'bloqueó', ago: 'hace {n}',
    tClassic: 'Clásico', tColorblind: 'Apto para daltonismo', tContrast: 'Alto contraste', tMono: 'Monocromo',
    updated: 'Actualizado a v{n} · reinicia Claude Code para aplicarlo',
  },
  pt: {
    context: 'Contexto', h5: '5 horas', d7: '7 dias', spend: 'Gasto', cost: 'Custo', last: 'último',
    agents: 'Agentes', running: '{n} em curso', idle: 'em espera', compact: 'compactar', compacted: '{n}× compactado',
    opened: 'Painel Cabina aberto.', closed: 'Painel Cabina fechado.', describe: 'Abre o painel Cabina (config: definições)',
    settings: 'Definições', language: 'Idioma', theme: 'Tema', auto: 'Automático', other: 'Outro idioma',
    otherHint: 'nome ou código, p. ex. swahili', close: 'fechar', hint: '↑↓ escolher · Enter guardar · Tab seguinte · Esc fechar',
    session: 'Sessão', prompts: '{n} prompts', tools: 'Ferram.', trend: 'Tendência · {n} turnos', files: 'Ficheiros', uncommitted: '{n} por commitar', clean: 'sem alterações',
    background: 'Fundo', bgAuto: 'Terminal', bgDark: 'Escuro', bgLight: 'Claro',
    secUsage: 'Consumo', secCost: 'Custo', secActivity: 'Atividade', secProject: 'Projeto', total: 'Total', duration: 'Duração', edited: '{n} editados',
    sections: 'Secções', secTrend: 'Tendência', secAgents: 'Agentes', secHooks: 'Hooks', blocked: 'bloqueou', ago: 'há {n}',
    tClassic: 'Clássico', tColorblind: 'Para daltonismo', tContrast: 'Alto contraste', tMono: 'Monocromático',
    updated: 'Atualizado para v{n} · reinicie o Claude Code para aplicar',
  },
  fr: {
    context: 'Contexte', h5: '5 heures', d7: '7 jours', spend: 'Dépense', cost: 'Coût', last: 'dernier',
    agents: 'Agents', running: '{n} en cours', idle: 'en attente', compact: 'compacter', compacted: '{n}× compacté',
    opened: 'Panneau Cabina ouvert.', closed: 'Panneau Cabina fermé.', describe: 'Ouvre le panneau Cabina (config : réglages)',
    settings: 'Réglages', language: 'Langue', theme: 'Thème', auto: 'Automatique', other: 'Autre langue',
    otherHint: 'nom ou code, ex. swahili', close: 'fermer', hint: '↑↓ choisir · Entrée valider · Tab suivant · Échap fermer',
    session: 'Session', prompts: '{n} invites', tools: 'Outils', trend: 'Tendance · {n} tours', files: 'Fichiers', uncommitted: '{n} non commités', clean: 'propre',
    background: 'Fond', bgAuto: 'Terminal', bgDark: 'Sombre', bgLight: 'Clair',
    secUsage: 'Consommation', secCost: 'Coût', secActivity: 'Activité', secProject: 'Projet', total: 'Total', duration: 'Durée', edited: '{n} modifiés',
    sections: 'Sections', secTrend: 'Tendance', secAgents: 'Agents', secHooks: 'Hooks', blocked: 'bloqué', ago: 'il y a {n}',
    tClassic: 'Classique', tColorblind: 'Adapté au daltonisme', tContrast: 'Contraste élevé', tMono: 'Monochrome',
    updated: "Mis à jour en v{n} · redémarrez Claude Code pour l'appliquer",
  },
  de: {
    context: 'Kontext', h5: '5 Std.', d7: '7 Tage', spend: 'Ausgaben', cost: 'Kosten', last: 'zuletzt',
    agents: 'Agenten', running: '{n} aktiv', idle: 'bereit', compact: 'kompaktieren', compacted: '{n}× kompaktiert',
    opened: 'Cabina-Bereich geöffnet.', closed: 'Cabina-Bereich geschlossen.', describe: 'Öffnet den Cabina-Bereich (config: Einstellungen)',
    settings: 'Einstellungen', language: 'Sprache', theme: 'Design', auto: 'Automatisch', other: 'Andere Sprache',
    otherHint: 'Name oder Code, z. B. swahili', close: 'schließen', hint: '↑↓ wählen · Enter speichern · Tab weiter · Esc schließen',
    session: 'Sitzung', prompts: '{n} Prompts', tools: 'Tools', trend: 'Verlauf · {n} Runden', files: 'Dateien', uncommitted: '{n} ungesichert', clean: 'sauber',
    background: 'Hintergrund', bgAuto: 'Terminal', bgDark: 'Dunkel', bgLight: 'Hell',
    secUsage: 'Verbrauch', secCost: 'Kosten', secActivity: 'Aktivität', secProject: 'Projekt', total: 'Gesamt', duration: 'Dauer', edited: '{n} bearbeitet',
    sections: 'Bereiche', secTrend: 'Verlauf', secAgents: 'Agenten', secHooks: 'Hooks', blocked: 'blockiert', ago: 'vor {n}',
    tClassic: 'Klassisch', tColorblind: 'Farbenblind-freundlich', tContrast: 'Hoher Kontrast', tMono: 'Monochrom',
    updated: 'Auf v{n} aktualisiert · Claude Code neu starten',
  },
  it: {
    context: 'Contesto', h5: '5 ore', d7: '7 giorni', spend: 'Spesa', cost: 'Costo', last: 'ultimo',
    agents: 'Agenti', running: '{n} in corso', idle: 'in attesa', compact: 'compatta', compacted: '{n}× compattato',
    opened: 'Pannello Cabina aperto.', closed: 'Pannello Cabina chiuso.', describe: 'Apre il pannello Cabina (config: impostazioni)',
    settings: 'Impostazioni', language: 'Lingua', theme: 'Tema', auto: 'Automatico', other: 'Altra lingua',
    otherHint: 'nome o codice, es. swahili', close: 'chiudi', hint: '↑↓ scegli · Invio salva · Tab avanti · Esc chiudi',
    session: 'Sessione', prompts: '{n} prompt', tools: 'Strum.', trend: 'Andamento · {n} turni', files: 'File', uncommitted: '{n} da committare', clean: 'pulito',
    background: 'Sfondo', bgAuto: 'Terminale', bgDark: 'Scuro', bgLight: 'Chiaro',
    secUsage: 'Consumo', secCost: 'Costo', secActivity: 'Attività', secProject: 'Progetto', total: 'Totale', duration: 'Durata', edited: '{n} modificati',
    sections: 'Sezioni', secTrend: 'Andamento', secAgents: 'Agenti', secHooks: 'Hook', blocked: 'bloccato', ago: '{n} fa',
    tClassic: 'Classico', tColorblind: 'Adatto al daltonismo', tContrast: 'Alto contrasto', tMono: 'Monocromatico',
    updated: 'Aggiornato a v{n} · riavvia Claude Code per applicarlo',
  },
}

// Cada idioma con su propio nombre, para reconocerlo aunque el panel esté en otro.
export const ENDONYM: Record<string, string> = {
  es: 'Español', en: 'English', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano',
}

const ALIASES: Record<string, string> = {
  english: 'en', inglés: 'en', ingles: 'en',
  spanish: 'es', español: 'es', espanol: 'es', castellano: 'es',
  portuguese: 'pt', português: 'pt', portugues: 'pt',
  french: 'fr', français: 'fr', francais: 'fr', francés: 'fr',
  german: 'de', deutsch: 'de', alemán: 'de',
  italian: 'it', italiano: 'it',
}

// "es-ES", "Español", "spanish" → "es"; lo que no reconoce se devuelve en minúsculas ("swahili").
export const normalize = (lang: string) => {
  const l = lang.trim().toLowerCase()
  const code = l.split(/[-_]/)[0]!
  return ALIASES[l] ?? (BUILT_IN[code] ? code : l)
}

export const fill = (template: string, n: number | string) => template.replace('{n}', String(n))

// Respuesta del modelo → Strings, o undefined si le falta alguna clave o pierde el {n}.
export const parseStrings = (text: string): Strings | undefined => {
  try {
    const raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Record<string, unknown>
    for (const [key, value] of Object.entries(en)) {
      const got = raw[key]
      if (typeof got !== 'string' || !got.trim() || (value.includes('{n}') && !got.includes('{n}'))) return undefined
    }
    return raw as Strings
  } catch {
    return undefined
  }
}

export const translatePrompt = (lang: string) =>
  `Translate the values of this JSON (labels of a compact developer status pane) into the language "${lang}". ` +
  `Keep every key, keep "{n}" as is, keep each value as short as the original. Reply with the JSON only.\n` +
  JSON.stringify(en)

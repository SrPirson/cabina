import { expect, test } from 'claude-code/testing'

import { BUILT_IN, fill, normalize, parseStrings } from '../hooks/i18n'

test('normaliza nombres y códigos de idioma', async () => {
  expect(normalize('es-ES')).toBe('es')
  expect(normalize('Español')).toBe('es')
  expect(normalize('spanish')).toBe('es')
  expect(normalize('pt_BR')).toBe('pt')
  expect(normalize('Swahili')).toBe('swahili')
})

test('todas las tablas tienen las mismas claves y conservan {n}', async () => {
  const keys = Object.keys(BUILT_IN.en!).sort()
  for (const table of Object.values(BUILT_IN)) {
    expect(Object.keys(table).sort()).toEqual(keys)
    expect(table.running).toContain('{n}')
    expect(table.compacted).toContain('{n}')
  }
  expect(fill(BUILT_IN.es!.running, 2)).toBe('2 en curso')
})

test('acepta una traducción válida y rechaza una incompleta', async () => {
  const ok = { ...BUILT_IN.en!, running: '{n} zinaendelea' }
  expect(parseStrings('Here:\n' + JSON.stringify(ok))?.running).toBe('{n} zinaendelea')
  expect(parseStrings(JSON.stringify({ ...ok, running: 'zinaendelea' }))).toBeUndefined()
  expect(parseStrings(JSON.stringify({ context: 'x' }))).toBeUndefined()
  expect(parseStrings('no json')).toBeUndefined()
})

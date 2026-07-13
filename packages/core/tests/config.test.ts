import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { isTypesRequired, loadCheckConfig } from '../src/config.ts'

const appA = join(import.meta.dir, 'fixtures-config', 'app-a')
const appB = join(import.meta.dir, 'fixtures-config', 'app-b')

describe('loadCheckConfig', () => {
  test('loads edge.check from the nearest package.json', () => {
    const config = loadCheckConfig(join(appA, 'templates', 'components'))
    expect(config).toEqual({
      requireTypes: ['templates/components/**'],
      exclude: ['templates/legacy/**'],
      severity: 'warn',
      baseDir: appA,
    })
  })

  test('returns null when the nearest package.json has no edge.check key', () => {
    expect(loadCheckConfig(join(appB, 'templates'))).toBeNull()
  })

  test('stops at the nearest package.json — does not inherit from an ancestor', () => {
    // fixtures-config/ itself has no package.json with edge.check; app-b's own
    // package.json is nearer and lacks the key, so discovery must not fall
    // through to some other ancestor.
    expect(loadCheckConfig(appB)).toBeNull()
  })
})

describe('isTypesRequired', () => {
  const config = loadCheckConfig(join(appA, 'templates', 'components'))!

  test('matches a requireTypes glob', () => {
    expect(isTypesRequired(config, join(appA, 'templates', 'components', 'card.edge'))).toBe(true)
  })

  test('exclude wins over requireTypes', () => {
    const legacyConfig = { ...config, requireTypes: ['**'] }
    expect(isTypesRequired(legacyConfig, join(appA, 'templates', 'legacy', 'banner.edge'))).toBe(false)
  })

  test('does not match files outside requireTypes globs', () => {
    expect(isTypesRequired(config, join(appA, 'templates', 'home.edge'))).toBe(false)
  })

  test('** matches nested directories', () => {
    expect(
      isTypesRequired(config, join(appA, 'templates', 'components', 'nested', 'card.edge')),
    ).toBe(true)
  })
})

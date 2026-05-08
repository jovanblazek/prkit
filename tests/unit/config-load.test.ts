import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadConfig } from '../../src/config/load.js'

describe('loadConfig', () => {
  it('merges global and repo config with repo values winning', async () => {
    const config = await loadConfig({
      cwd: '/repo',
      homeDir: '/home/test',
      readFile: async (filePath) => {
        if (filePath === '/home/test/.config/prkit/config.yml') {
          return [
            'ticketBranchPattern: "^feat/(\\\\w+-\\\\d+)$"',
            'baseBranch: main',
            'defaultReviewers: [alice]',
            'draftByDefault: true',
          ].join('\n')
        }
        if (filePath === '/repo/.prkit.yml') {
          return ['ticketBranchPattern: "^bug/(\\\\w+-\\\\d+)$"', 'baseBranch: develop'].join(
            '\n',
          )
        }
        return null
      },
    })

    expect(config.ticketProvider).toBe('linear')
    expect(config.ticketBranchPattern).toBe('^bug/(\\w+-\\d+)$')
    expect(config.baseBranch).toBe('develop')
    expect(config.defaultReviewers).toEqual(['alice'])
    expect(config.draftByDefault).toBe(true)
    expect(config.assignToCurrentUser).toBe(false)
  })

  it('fails fast on unknown config fields', async () => {
    await expect(
      loadConfig({
        cwd: '/repo',
        homeDir: '/home/test',
        readFile: async (filePath) => {
          if (filePath === '/home/test/.config/prkit/config.yml') {
            return [
              'ticketBranchPattern: "^feat/(\\\\w+-\\\\d+)$"',
              'baseBranch: main',
              'surprise: true',
            ].join('\n')
          }
          return null
        },
      }),
    ).rejects.toThrow(/unknown/i)
  })

  it('fails fast on unknown reviewerRules entry fields', async () => {
    await expect(
      loadConfig({
        cwd: '/repo',
        homeDir: '/home/test',
        readFile: async (filePath) => {
          if (filePath === '/repo/.prkit.yml') {
            return [
              'ticketBranchPattern: "^feat/(\\\\w+-\\\\d+)$"',
              'baseBranch: main',
              'reviewerRules:',
              '  - pattern: "src/**"',
              '    reviewers: [alice]',
              '    extra: true',
            ].join('\n')
          }
          return null
        },
      }),
    ).rejects.toThrow(/unknown/i)
  })

  it('requires reviewers on each reviewerRules entry', async () => {
    await expect(
      loadConfig({
        cwd: '/repo',
        homeDir: '/home/test',
        readFile: async (filePath) => {
          if (filePath === '/repo/.prkit.yml') {
            return [
              'ticketBranchPattern: "^feat/(\\\\w+-\\\\d+)$"',
              'baseBranch: main',
              'reviewerRules:',
              '  - pattern: "src/**"',
            ].join('\n')
          }
          return null
        },
      }),
    ).rejects.toThrow(/Invalid config/i)
  })

  it('includes config paths for invalid top-level field values', async () => {
    await expect(
      loadConfig({
        cwd: '/repo',
        homeDir: '/home/test',
        readFile: async (filePath) => {
          if (filePath === '/repo/.prkit.yml') {
            return [
              'ticketBranchPattern: 123',
              'baseBranch: false',
            ].join('\n')
          }
          return null
        },
      }),
    ).rejects.toThrow(
      /Invalid config: ticketBranchPattern: .*baseBranch: /i,
    )
  })

  it('shows a first-run setup message when no config file is found', async () => {
    await expect(
      loadConfig({
        cwd: '/repo',
        homeDir: '/home/test',
        readFile: async () => null,
      }),
    ).rejects.toThrow(/Missing prkit configuration/i)
  })

  it('shows a setup example when required top-level config is missing', async () => {
    await expect(
      loadConfig({
        cwd: '/repo',
        homeDir: '/home/test',
        readFile: async (filePath) => {
          if (filePath === '/repo/.prkit.yml') {
            return 'titleFormat: "{id}: {title}"'
          }
          return null
        },
      }),
    ).rejects.toThrow(/Required keys:\n- ticketBranchPattern\n- baseBranch/i)
  })

  it('resolves descriptionTemplatePath relative to the repo config when present', async () => {
    const config = await loadConfig({
      cwd: '/repo',
      homeDir: '/home/test',
      readFile: async (filePath) => {
        if (filePath === '/home/test/.config/prkit/config.yml') {
          return [
            'ticketBranchPattern: "^feat/(\\\\w+-\\\\d+)$"',
            'baseBranch: main',
            'descriptionTemplatePath: templates/global.md',
          ].join('\n')
        }
        if (filePath === '/repo/.prkit.yaml') {
          return [
            'ticketBranchPattern: "^feat/(\\\\w+-\\\\d+)$"',
            'baseBranch: main',
            'descriptionTemplatePath: docs/pr.md',
          ].join('\n')
        }
        return null
      },
    })

    expect(config.descriptionTemplatePath).toBe(path.resolve('/repo', 'docs/pr.md'))
  })

  it('resolves descriptionTemplatePath relative to the global config directory when repo config is absent', async () => {
    const config = await loadConfig({
      cwd: '/repo',
      homeDir: '/home/test',
      readFile: async (filePath) => {
        if (filePath === '/home/test/.config/prkit/config.yaml') {
          return [
            'ticketBranchPattern: "^feat/(\\\\w+-\\\\d+)$"',
            'baseBranch: main',
            'descriptionTemplatePath: templates/global.md',
          ].join('\n')
        }
        return null
      },
    })

    expect(config.descriptionTemplatePath).toBe(
      path.resolve('/home/test/.config/prkit', 'templates/global.md'),
    )
  })

  it('resolves inherited descriptionTemplatePath relative to the global config when repo config does not override it', async () => {
    const config = await loadConfig({
      cwd: '/repo',
      homeDir: '/home/test',
      readFile: async (filePath) => {
        if (filePath === '/home/test/.config/prkit/config.yml') {
          return [
            'ticketBranchPattern: "^feat/(\\\\w+-\\\\d+)$"',
            'baseBranch: main',
            'descriptionTemplatePath: templates/global.md',
          ].join('\n')
        }
        if (filePath === '/repo/.prkit.yml') {
          return ['ticketBranchPattern: "^bug/(\\\\w+-\\\\d+)$"', 'baseBranch: develop'].join(
            '\n',
          )
        }
        return null
      },
    })

    expect(config.descriptionTemplatePath).toBe(
      path.resolve('/home/test/.config/prkit', 'templates/global.md'),
    )
  })

  it('normalizes malformed yaml parse failures into config errors', async () => {
    let thrown: unknown

    try {
      await loadConfig({
        cwd: '/repo',
        homeDir: '/home/test',
        readFile: async (filePath) => {
          if (filePath === '/repo/.prkit.yml') {
            return 'ticketBranchPattern: [unterminated'
          }
          return null
        },
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({
      kind: 'CONFIG_ERROR',
    })
  })
})

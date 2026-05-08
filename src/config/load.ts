import { readFile as readFileFromFs } from 'node:fs/promises'
import path from 'node:path'

import { ZodError } from 'zod'
import YAML from 'yaml'

import { PrkitError } from '../core/errors.js'
import { configSchema, type PrkitConfig } from './schema.js'

const GLOBAL_NAMES = ['config.yml', 'config.yaml']
const REPO_NAMES = ['.prkit.yml', '.prkit.yaml']
const REQUIRED_TOP_LEVEL_KEYS = ['ticketBranchPattern', 'baseBranch'] as const

interface LocatedConfigFile {
  path: string
  content: string
}

function formatIssuePath(pathSegments: PropertyKey[]): string {
  if (pathSegments.length === 0) {
    return 'config'
  }

  return pathSegments
    .map((segment) =>
      typeof segment === 'number' ? String(segment) : String(segment),
    )
    .join('.')
}

function formatZodIssue(error: ZodError): string {
  return error.issues
    .map((issue) => {
      if (issue.code === 'unrecognized_keys') {
        const location =
          issue.path.length > 0 ? formatIssuePath(issue.path) : 'config'
        return `${location}: unknown key${issue.keys.length === 1 ? '' : 's'} ${issue.keys.join(', ')}`
      }

      return `${formatIssuePath(issue.path)}: ${issue.message}`
    })
    .join('; ')
}

function missingConfigMessage(): string {
  return [
    'Missing prkit configuration.',
    '',
    'Create one of:',
    '- .prkit.yml',
    '- .prkit.yaml',
    '- ~/.config/prkit/config.yml',
    '- ~/.config/prkit/config.yaml',
    '',
    'Required keys:',
    '- ticketBranchPattern',
    '- baseBranch',
    '',
    'Example:',
    'ticketBranchPattern: "^feature/(ENG-\\\\d+)-"',
    'baseBranch: main',
  ].join('\n')
}

function isMissingRequiredTopLevelConfig(error: ZodError): boolean {
  const missingPaths = new Set(
    error.issues
      .filter(
        (issue) =>
          issue.code === 'invalid_type' &&
          issue.path.length === 1 &&
          typeof issue.path[0] === 'string' &&
          issue.message.includes('received undefined'),
      )
      .map((issue) => String(issue.path[0])),
  )

  return REQUIRED_TOP_LEVEL_KEYS.every((key) => missingPaths.has(key))
}

export interface LoadConfigInput {
  cwd: string
  homeDir: string
  readFile?: (path: string) => Promise<string | null>
}

async function defaultReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFileFromFs(filePath, 'utf8')
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null
    }
    throw error
  }
}

async function readFirst(
  paths: string[],
  readFile: (path: string) => Promise<string | null>,
): Promise<LocatedConfigFile | null> {
  for (const filePath of paths) {
    const content = await readFile(filePath)
    if (content !== null) {
      return { path: filePath, content }
    }
  }

  return null
}

function parseConfigFile(file: LocatedConfigFile): Record<string, unknown> {
  let parsed: unknown

  try {
    parsed = YAML.parse(file.content)
  } catch (error) {
    throw new PrkitError(
      'CONFIG_ERROR',
      `Invalid YAML in config file: ${file.path}`,
      {
        cause: error instanceof Error ? error.message : String(error),
      },
    )
  }

  if (parsed === null) {
    return {}
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PrkitError(
      'CONFIG_ERROR',
      `Config file must contain an object: ${file.path}`,
    )
  }

  return parsed as Record<string, unknown>
}

function resolveTemplatePath(
  config: PrkitConfig,
  input: LoadConfigInput,
  repoConfig: LocatedConfigFile | null,
  repoConfigData: Record<string, unknown>,
  globalConfig: LocatedConfigFile | null,
  globalConfigData: Record<string, unknown>,
): PrkitConfig {
  if (!config.descriptionTemplatePath) {
    return config
  }

  const descriptionTemplateSource =
    Object.hasOwn(repoConfigData, 'descriptionTemplatePath')
      ? repoConfig
      : Object.hasOwn(globalConfigData, 'descriptionTemplatePath')
        ? globalConfig
        : null

  const baseDir = descriptionTemplateSource
    ? path.dirname(descriptionTemplateSource.path)
    : input.cwd

  return {
    ...config,
    descriptionTemplatePath: path.resolve(
      baseDir,
      config.descriptionTemplatePath,
    ),
  }
}

export async function loadConfig(input: LoadConfigInput): Promise<PrkitConfig> {
  const readFile = input.readFile ?? defaultReadFile
  const globalConfig = await readFirst(
    GLOBAL_NAMES.map((name) =>
      path.join(input.homeDir, '.config', 'prkit', name),
    ),
    readFile,
  )
  const repoConfig = await readFirst(
    REPO_NAMES.map((name) => path.join(input.cwd, name)),
    readFile,
  )

  const globalConfigData = globalConfig ? parseConfigFile(globalConfig) : {}
  const repoConfigData = repoConfig ? parseConfigFile(repoConfig) : {}
  const merged = {
    ...globalConfigData,
    ...repoConfigData,
  }

  try {
    return resolveTemplatePath(
      configSchema.parse(merged),
      input,
      repoConfig,
      repoConfigData,
      globalConfig,
      globalConfigData,
    )
  } catch (error) {
    if (error instanceof ZodError) {
      if (isMissingRequiredTopLevelConfig(error)) {
        throw new PrkitError('CONFIG_ERROR', missingConfigMessage(), {
          issues: error.issues,
        })
      }

      const issue = error.issues[0]
      const message =
        issue?.code === 'unrecognized_keys'
          ? formatZodIssue(error)
          : `Invalid config: ${formatZodIssue(error)}`

      throw new PrkitError('CONFIG_ERROR', message, {
        issues: error.issues,
      })
    }

    throw error
  }
}

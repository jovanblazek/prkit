import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrkitError } from '../core/errors.js'

export function resolveEditorCommand(editorCommand?: string): string {
  return editorCommand ?? process.env.VISUAL ?? process.env.EDITOR ?? 'vi'
}

export async function editBody(
  initialBody: string,
  editorCommand?: string,
): Promise<string> {
  const resolvedEditorCommand = resolveEditorCommand(editorCommand)

  if (!resolvedEditorCommand) {
    throw new PrkitError(
      'ENVIRONMENT_ERROR',
      'No editor configured. Set the EDITOR environment variable to your preferred editor.',
    )
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'prkit-'))
  const file = path.join(dir, 'pull-request.md')

  await writeFile(file, initialBody, 'utf8')

  await new Promise<void>((resolve, reject) => {
    const child = spawn(resolvedEditorCommand, [file], {
      shell: true,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Editor exited with code ${code ?? 1}`))
    })
  })

  return readFile(file, 'utf8')
}

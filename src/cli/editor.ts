import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export async function editBody(
  initialBody: string,
  editorCommand = process.env.EDITOR,
): Promise<string> {
  if (!editorCommand) {
    throw new Error('No editor configured')
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'prkit-'))
  const file = path.join(dir, 'pull-request.md')

  await writeFile(file, initialBody, 'utf8')

  await new Promise<void>((resolve, reject) => {
    const child = spawn(editorCommand, [file], {
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

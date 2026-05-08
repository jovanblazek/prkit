export interface CommandRunner {
  run(input: {
    cwd: string
    args: string[]
    stdin?: string
  }): Promise<{
    stdout: string
    stderr: string
    exitCode: number
  }>
}

export function splitCommandLine(command: string): string[] {
  const args: string[] = []
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
  let match

  while ((match = regex.exec(command)) !== null) {
    if (match[1]) {
      // Quoted with double quotes
      args.push(match[1])
    } else if (match[2]) {
      // Quoted with single quotes
      args.push(match[2])
    } else {
      // Unquoted word
      args.push(match[0])
    }
  }

  return args
}

export function normalizeCommandLine(cmd?: string[] | string) {
  return cmd ? typeof cmd === 'string' ? splitCommandLine(cmd) : cmd : cmd
}

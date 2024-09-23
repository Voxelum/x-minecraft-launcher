export const parseCFG = (cfg: string) => {
  const lines = cfg.split('\n').map((line) => line.trim())
  const result: Record<string, string> = {}
  for (const line of lines) {
    const [key, value] = line.split('=')
    result[key] = value
  }
  return result
}

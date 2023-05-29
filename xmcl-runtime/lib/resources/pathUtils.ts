export function shouldIgnoreFile(file: string) {
  return file.endsWith('.pending') || file.endsWith('.DS_Store') || file.endsWith('.backup')
}

export function shouldIgnoreFile(file: string) {
  return (
    file.endsWith('.pending') ||
    file.endsWith('.DS_Store') ||
    file.endsWith('.backup') ||
    // file.endsWith('.txt') ||
    file.endsWith('.gitkeep') ||
    file.endsWith('.gitignore') ||
    file.endsWith('.rartemp')
  )
}

import { cp, rename, rm } from 'fs/promises'

/**
 * Move to a vacant transaction path. AppX virtualization can make even sibling
 * paths cross volumes, so the fallback is deliberately not atomic.
 */
export async function move(source: string, destination: string, onMoved?: () => void) {
  try {
    await rename(source, destination)
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EXDEV') throw error
    try {
      await cp(source, destination, {
        recursive: true,
        force: false,
        errorOnExist: true,
        preserveTimestamps: true,
        verbatimSymlinks: true,
      })
    } catch (copyError) {
      if (!copyError || typeof copyError !== 'object' || !('code' in copyError) || copyError.code !== 'EEXIST') {
        try {
          await rm(destination, { recursive: true, force: true })
        } catch (cleanupError) {
          throw new AggregateError([copyError, cleanupError], `Failed to clean up incomplete copy to ${destination}`)
        }
      }
      throw copyError
    }
    // Register the complete backup before deleting its source, which can fail.
    onMoved?.()
    await rm(source, { recursive: true })
    return
  }
  onMoved?.()
}

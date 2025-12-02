import { platform } from 'os'
import { join, basename } from 'path'
import { readlinkSync, readdirSync, readFileSync } from 'fs-extra'

/**
 * Detect if running on Niri Wayland compositor.
 * Uses both environment variable and process detection for comprehensive coverage.
 * Result is cached at module load time.
 */
function detectNiri(): boolean {
  if (platform() !== 'linux') {
    return false
  }

  // Check environment variable first (set by Niri session)
  if (process.env.XDG_CURRENT_DESKTOP?.toLowerCase() === 'niri') {
    return true
  }

  // Fallback: check if niri process is running by scanning /proc
  // This covers cases where XDG_CURRENT_DESKTOP is not set
  try {
    const procDirs = readdirSync('/proc').filter(dir => /^\d+$/.test(dir))
    for (const pid of procDirs) {
      try {
        const commPath = join('/proc', pid, 'comm')
        const comm = readFileSync(commPath, 'utf8').trim()
        if (comm === 'niri') {
          const exePath = readlinkSync(join('/proc', pid, 'exe'))
          if (basename(exePath) === 'niri') {
            return true
          }
        }
      } catch {
        // Process may have exited, continue
      }
    }
  } catch {
    // /proc not accessible, skip process detection
  }

  return false
}

// Cache the Niri detection result at app start
export const isNiri = detectNiri()

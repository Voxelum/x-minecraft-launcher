/**
 * Parse command line arguments similar to PrismLauncher
 * Supports:
 * -l, --launch <instance>: Launch instance by name or path
 * -s, --server <address>: Connect to server after launch
 * -a, --account <profile>: Use specific account
 * --show <instance>: Show instance window (focus launcher)
 */

export interface ParsedCLIArgs {
  launch?: string
  server?: string
  account?: string
  show?: string
}

/**
 * Parse argv array into structured CLI arguments
 */
export function parseCLIArguments(argv: string[]): ParsedCLIArgs {
  const args: ParsedCLIArgs = {}
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const nextArg = argv[i + 1]
    
    if ((arg === '-l' || arg === '--launch') && nextArg) {
      args.launch = nextArg
      i++
    } else if ((arg === '-s' || arg === '--server') && nextArg) {
      args.server = nextArg
      i++
    } else if ((arg === '-a' || arg === '--account') && nextArg) {
      args.account = nextArg
      i++
    } else if (arg === '--show' && nextArg) {
      args.show = nextArg
      i++
    }
  }
  
  return args
}

/**
 * Check if CLI arguments contain any launch-related commands
 */
export function hasCLICommands(argv: string[]): boolean {
  return argv.some(arg => 
    arg === '-l' || 
    arg === '--launch' || 
    arg === '--show' ||
    arg === 'launch' // Legacy format support
  )
}

/**
 * Get legacy launch arguments (for backwards compatibility)
 * Format: launch "<user-id>" "<instance-path>"
 */
export function getLegacyLaunchArguments(argv: string[]): [string, string] | null {
  const indexOfLaunch = argv.indexOf('launch')
  if (indexOfLaunch > 0) {
    const userId = argv[indexOfLaunch + 1]
    const instancePath = argv[indexOfLaunch + 2]
    if (userId && instancePath) {
      return [userId, instancePath]
    }
  }
  return null
}

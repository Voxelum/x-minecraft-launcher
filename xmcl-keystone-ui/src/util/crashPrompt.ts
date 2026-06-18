function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}

export function toVirtualInstancePath(filePath: string, instancePath: string) {
  const normalizedFile = normalizePath(filePath)
  const normalizedInstance = normalizePath(instancePath)

  if (!normalizedFile || !normalizedInstance) return filePath

  const instanceRoot = normalizedInstance.endsWith('/') ? normalizedInstance : `${normalizedInstance}/`
  if (!normalizedFile.startsWith(instanceRoot)) return filePath

  const relative = normalizedFile.slice(instanceRoot.length)
  if (!relative) return filePath

  const [root, ...rest] = relative.split('/')
  if (root === '.minecraft') {
    return rest.join('/')
  }

  return relative
}

export function getCrashPrompt(useCN: boolean, crash: string, log: string, localeCode: string) {
  if (useCN) {
    return `你是Minecraft 崩溃报告（crash report）助手，帮助我分析crash造成的原因。你应当首先分析出游戏崩溃的主要原因（java，游戏原版library，mod，或者是其他原因）
对于java问题或者游戏原版library，你应当直接提醒我。
若是mod造成的崩溃，你应当通过日志分析出哪些mod可能造成这些错误，并提示我。注意我正在是用X Minecraft Launcher，关于修复崩溃的建议（如下载 Mod）应当在 X Minecraft Launcher 里进行。

如果实在分析不出具体原因，请告知我应当联系开发者。添加QQ群：858391850

这是当前的崩溃报告:
\`\`\`
${crash}
\`\`\`

这是最新的日志作为补充：
\`\`\`
${log}
\`\`\`
`
  } else {
    return `
You are a Minecraft crash report assistant, helping me analyze the causes of crashes. You should first identify the main reason for the game crash (Java issues, missing vanilla game libraries, mod-related problems, or other causes).

For Java issues or missing vanilla game libraries, you should provide direct reminders. Please note that I am using X Minecraft Launcher, and any suggestions for fixing crashes (such as downloading mods) should be done within X Minecraft Launcher.

If the crash is caused by mods, you should analyze the logs to determine which mods may be responsible for the errors and notify me.

If the specific cause cannot be determined, please inform me that I should contact the developers. Join discord: https://discord.gg/W5XVwYY7GQ

I prefer you to response my with locale ${localeCode}.

Here is the current crash report:
\`\`\`
${crash}
\`\`\`
Here is the latest log as supplementary information:
\`\`\`
${log}
\`\`\`
    `
  }
}

/**
 * Prompt for the launcher's built-in agent (NOT an external chat).
 *
 * Unlike {@link getCrashPrompt}, this deliberately omits the "you are a crash
 * assistant", locale, and "contact the developers" boilerplate: the agent
 * already gets that from its system prompt + session-context snapshot, and is
 * instructed to reply in the user's locale. Here we only hand it the failure
 * it is looking at and point it at the actions it can actually take.
 */
export function getCrashAgentPrompt(
  crash: string,
  log: string,
  crashPath?: string,
  logPath?: string,
) {
  const crashSection = crashPath
    ? `Crash report file (inspect it via the instance virtual filesystem using vfs_read/vfs_list): ${crashPath}`
    : `Crash report / launcher error:\n\`\`\`\n${crash || '<none captured>'}\n\`\`\``

  const logSection = logPath
    ? `Latest log file (inspect it via the instance virtual filesystem using vfs_read/vfs_list): ${logPath}`
    : `Latest log (supplementary):\n\`\`\`\n${log || '<none captured>'}\n\`\`\``

  return `My Minecraft game crashed or failed to launch. Find the root cause and fix it for me within XMCL.

Investigate before concluding: read the latest log and crash report from the instance virtual filesystem, inspect the installed mods and the resolved version / Java setup, and cross-reference them with the failure details below. When the cause is actionable, apply the fix yourself (disable or uninstall the offending mod, install a missing dependency, switch Java, etc.) and tell me what you changed. If it is a Java or vanilla-library problem, or you cannot pin down the cause, say so plainly.

${crashSection}

${logSection}
`
}

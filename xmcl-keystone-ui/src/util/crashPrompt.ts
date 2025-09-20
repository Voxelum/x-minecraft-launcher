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

import { createAgentTools } from './toolSupport'
import { useLocalAgent } from './local'

export interface ModpackReleaseProposal {
  version: string
  changelog: string
}

/**
 * A dedicated, one-tool local agent used only to propose a version number and
 * changelog for a new modpack release, based on a mod/file diff and any
 * existing draft notes. It reuses the same configured AI provider/model as
 * the launcher's main assistant, but keeps its own (throwaway) conversation
 * history per instance and exposes exactly one tool so the result is always
 * structured instead of free-form text that needs to be parsed.
 */
export function useModpackChangelogAgent() {
  const scope = ref('')
  let sessionContext = ''
  let captured: ModpackReleaseProposal | undefined

  const local = useLocalAgent({
    agentId: 'modpack-changelog',
    getScope: () => scope.value,
    getLocale: () => 'en',
    createTools: async () => createAgentTools([
      {
        name: 'propose_modpack_release',
        label: 'Propose modpack release',
        description: 'Submit the final proposed version number and changelog for this modpack release. Call this exactly once, as the last step.',
        parameters: {
          type: 'object',
          properties: {
            version: { type: 'string', description: 'The proposed semantic version number for this release, e.g. 1.2.3.' },
            changelog: { type: 'string', description: 'The final changelog text, in Markdown.' },
          },
          required: ['version', 'changelog'],
        },
        execute: (args: { version: string; changelog: string }) => {
          captured = { version: String(args.version ?? ''), changelog: String(args.changelog ?? '') }
          return 'Release notes recorded.'
        },
      },
    ]),
    getSessionContext: () => ({ releaseContext: sessionContext }),
  })

  /**
   * Ask the AI to propose a version number and changelog.
   * @param scopeKey A stable key to isolate (throwaway) conversation history, typically the instance path.
   * @param context Freeform context: instance info, current version, mod diff, and any existing draft notes.
   * @param instruction The user-facing instruction sent as the chat message.
   */
  async function generate(scopeKey: string, context: string, instruction: string): Promise<ModpackReleaseProposal> {
    if (scope.value !== scopeKey) {
      scope.value = scopeKey
      await local.load(scopeKey)
    }
    sessionContext = context
    captured = undefined
    await local.reset()
    await local.send(instruction)
    if (local.runError.value) {
      throw new Error(local.runError.value)
    }
    if (!captured) {
      throw new Error('The AI did not propose a release.')
    }
    return captured
  }

  return {
    running: local.running,
    generate,
  }
}

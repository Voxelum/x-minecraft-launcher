/**
 * Destinations Vardrynn owns for support, feedback and documentation.
 * Every visible help link should come from here so ownership stays in one place.
 * Upstream attribution links are separate and intentionally point at XMCL.
 */
export const VARDRYNN_REPOSITORY_URL = 'https://github.com/MichaelOlave/x-minecraft-launcher'
export const VARDRYNN_ISSUES_URL = `${VARDRYNN_REPOSITORY_URL}/issues`
export const VARDRYNN_NEW_ISSUE_URL = `${VARDRYNN_ISSUES_URL}/new`

/** Attribution only: the project Vardrynn is built on. */
export const UPSTREAM_PROJECT_URL = 'https://github.com/Voxelum/x-minecraft-launcher'

/** Sent to content providers (Modrinth asks for an identifiable agent with a contact). */
export function createVardrynnUserAgent(version: string) {
  return `vardrynn/launcher/${version} (${VARDRYNN_REPOSITORY_URL})`
}

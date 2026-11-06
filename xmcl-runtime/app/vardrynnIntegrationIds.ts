const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SNOWFLAKE = /^\d{16,20}$/

/** Vardrynn's Microsoft (Azure) application ID, or undefined when this build has none. */
export function resolveMicrosoftClientId(value: unknown): string | undefined {
  return typeof value === 'string' && GUID.test(value.trim()) ? value.trim() : undefined
}

/** Vardrynn's Discord application ID, or undefined when this build has none. */
export function resolveDiscordAppId(value: unknown): string | undefined {
  return typeof value === 'string' && SNOWFLAKE.test(value.trim()) ? value.trim() : undefined
}

export const MICROSOFT_CLIENT_ID_UNCONFIGURED = 'vardrynn_microsoft_client_unconfigured'

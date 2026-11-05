/** AppInstaller updates stay disabled until Vardrynn owns signed release hosting (phase 5). */
export async function buildAppInstaller(_version: string, _destination: string, _publisher: string): Promise<never> {
  throw new Error('Vardrynn AppInstaller release hosting is not configured')
}

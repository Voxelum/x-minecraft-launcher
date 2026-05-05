import { deserialize, deserializeSync, serialize, serializeSync, TagType } from '@xmcl/nbt'

export class ServerInfo {
  @TagType(TagType.String)
  icon = ''

  @TagType(TagType.String)
  ip = ''

  @TagType(TagType.String)
  name = ''

  @TagType(TagType.Byte)
  acceptTextures = 0
}

/**
 * The servers.dat format server information, contains known host displayed in "Multipler" page.
 */
export class ServersData {
  @TagType([ServerInfo])
  servers: ServerInfo[] = []
}

/**
 * Read the server information from the binary data of .minecraft/server.dat file, which stores the local known server host information.
 *
 * @param buff The binary data of .minecraft/server.dat
 */
export async function readServerInfo(buff: Uint8Array): Promise<ServerInfo[]> {
  const value = await deserialize(buff, { type: ServersData })
  return value.servers
}

/**
 * Write the information to NBT format used by .minecraft/server.dat file.
 *
 * @param infos The array of server information.
 */
export function writeServerInfo(infos: ServerInfo[]): Promise<Uint8Array> {
  const tag = new ServersData()
  tag.servers = infos
  return serialize(tag)
}

/**
 * Read the server information from the binary data of .minecraft/server.dat file, which stores the local known server host information.
 *
 * @param buff The binary data of .minecraft/server.dat
 */
export function readServerInfoSync(buff: Uint8Array): ServerInfo[] {
  const value = deserializeSync(buff, { type: ServersData })
  return value.servers
}

/**
 * Write the information to NBT format used by .minecraft/server.dat file.
 *
 * @param infos The array of server information.
 */
export function writeServerInfoSync(infos: ServerInfo[]): Uint8Array {
  const tag = new ServersData()
  tag.servers = infos
  return serializeSync(tag)
}

import { createHash } from 'crypto'

export function getOfflineUUID(username: string) {
  const md5Bytes = createHash('md5').update(`OfflinePlayer:${username}`).digest()
  md5Bytes[6] &= 0x0f /* clear version        */
  md5Bytes[6] |= 0x30 /* set to version 3     */
  md5Bytes[8] &= 0x3f /* clear variant        */
  md5Bytes[8] |= 0x80 /* set to IETF variant  */
  return md5Bytes.toString('hex').replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, '$1-$2-$3-$4-$5')
}

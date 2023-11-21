export function guessCurseforgeFileUrl(id: number, name: string) {
  const fileId = id.toString()
  return [`https://edge.forgecdn.net/files/${fileId.slice(0, 4)}/${fileId.slice(4)}/${name}`, `https://mediafiles.forgecdn.net/files/${fileId.slice(0, 4)}/${fileId.slice(4)}/${name}`]
}

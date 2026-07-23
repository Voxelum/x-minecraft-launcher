/**
 * On-demand world workflow help. World listing and deletion use the VFS;
 * remaining operations use the virtual CLI.
 */
export const WORLDS_CLI_INSTRUCTIONS = [
  'World CLI usage:',
  '- `vfs_list saves` lists worlds; use the world folder `name` as `saveName`. `vfs_read saves/<saveName>` reads one.',
  '- `vfs_rm` with `saves/<saveName>` deletes a world. Confirm first.',
  '- `bash world import <absoluteSource> [saveName]` imports a zip or folder; `saveName` defaults to the source name.',
  '- `bash world export <saveName> <absoluteDestination> [--folder]` exports a zip by default; pass `--folder` for a directory.',
  '- `bash world clone <saveName> [newSaveName] [destinationInstancePath]` clones into the current instance by default.',
  '- `bash world link <saveName>` links a singleplayer world as the local dedicated-server world; use `help domain server` to configure or run that server.',
  '- Quote world names and Windows paths that contain spaces. Use `bash help world` for the same syntax on demand.',
].join('\n')

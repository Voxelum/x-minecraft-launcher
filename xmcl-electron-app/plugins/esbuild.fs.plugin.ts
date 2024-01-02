import { Plugin } from 'esbuild'

export default function createFSPlugin(): Plugin {
  return {
    name: 'replace-fs',
    setup(build) {
      build.onResolve({ filter: /^fs\/promises$/g }, async ({ path }) => ({
        path: require.resolve('fs-extra'),
      }))
    },
  }
}

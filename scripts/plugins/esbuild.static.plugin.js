/**
 * Resolve import of static resource to real static resource path
 * @param {string} staticRoot The static folder root
 * @returns {import('esbuild').Plugin}
 */
module.exports = function createStaticPlugin(staticRoot) {
  return {
    name: 'resolve-static',
    setup(build) {
      build.onResolve({ filter: /@static\/.+/g }, async ({ path }) => ({
        path: path.replace('/@static', staticRoot)
      }))
    }
  }
}

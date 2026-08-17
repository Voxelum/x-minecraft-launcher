/**
 * `@xmcl/runtime-api` stand-in for the renderer bridge bundle.
 *
 * The reused preload modules import it for types only (`WindowController`,
 * `ServiceChannels`, ...), so nothing is needed at runtime. Keeping the module
 * empty is what stops the command registry and its zod schemas from ending up
 * in the injected script.
 */

export {}

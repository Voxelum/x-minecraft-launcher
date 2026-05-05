/**
 * The core package for launching Minecraft.
 * It provides the {@link Version.parse} function to parse Minecraft version,
 * and the {@link launch} function to launch the game.
 *
 * @packageDocumentation
 * @module @xmcl/core
 */

export * from './launch'
export * from './version'
export * from './platform'
export * from './folder'
export { checksum } from './utils'
export * from './header'

import { RuntimeVersions } from '@xmcl/instance'

export function generateBaseName(runtime: RuntimeVersions) {
    let name = runtime.minecraft
    if (runtime.forge) {
        name += `-forge${runtime.forge}`
    } else if (runtime.liteloader) {
        name += `-liteloader${runtime.liteloader}`
    } else if (runtime.fabricLoader) {
        name += `-fabric${runtime.fabricLoader}`
    } else if (runtime.quiltLoader) {
        name += `-quilt${runtime.quiltLoader}`
    } else if (runtime.neoForged) {
        name += `-neoforge${runtime.neoForged}`
    } else if (runtime.labyMod) {
        name += `-labyMod${runtime.labyMod}`
    }
    if (runtime.optifine) {
        name += `-optifine${runtime.optifine}`
    }
    return name
}

export function generateDistinctName(baseName: string, names: string[]) {
    let name = baseName
    let idx = 1
    while (names.includes(name)) {
        name = `${name}-${idx++}`
    }
    return name
}

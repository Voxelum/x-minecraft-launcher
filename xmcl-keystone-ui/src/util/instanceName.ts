import { RuntimeVersions } from '@xmcl/runtime-api'

export function generateDistinctName(names: string[], runtime: RuntimeVersions) {
    let name = runtime.minecraft
    if (runtime.forge) {
        name += `-forge${runtime.forge}`
    } else if (runtime.liteloader) {
        name += `-liteloader${runtime.liteloader}`
    } else if (runtime.fabricLoader) {
        name += `-fabricLoader${runtime.fabricLoader}`
    } else if (runtime.quiltLoader) {
        name += `-quiltLoader${runtime.quiltLoader}`
    }
    let idx = 1
    while (names.includes(name)) {
        name = `${name}-${idx++}`
    }
    return name
}

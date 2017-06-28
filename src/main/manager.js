class LauncherRuntime {
    constructor() {
        this.authRegistry = new Map()
        this.authSelected = config.authSelected
        this.register('mojang', AuthService.newYggdrasilAuthService())
    }
    constructor(config) {
        this.authRegistry = new Map()
        this.authSelected = config.authSelected
        this.register('mojang', AuthService.newYggdrasilAuthService())
    }
    registerAuth(name, constructor) {
        if (this.registry.has(name))
            throw new Error('')
        this.registry.set(name, constructor)
    }

    select(name) {
        if (this.register.has(name))
            this.select = name
        else throw new Error('')
    }
}

class Mananger {
}
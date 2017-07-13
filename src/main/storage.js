const fs = require('fs')
const path = require('path')
export class ProjectStructure {
    constructor(root) {
        this.root = root
    }
    get profiles() { return path.join(root, 'profiles') }
    get resourcepacks() { return path.join(root, 'resourcepacks') }
}

export async function loadAll(location) {

    return new Promise((resolve, reject) => {
        let tree = {}

        resolve(tree)

    });
}
function loadProfiles(location) {

    fs.readFile(l)
}

function loadResourcePacks(location) { }
function loadMods(location){}
function loadServers(location){}

import uuid from 'uuid'
import { ServerInfo } from 'ts-minecraft'

import launcher from '../launcher'

const fs = require('fs')

const PROFILE_NAME = 'profile.json'

function parse(content) {
    if (typeof content === 'string') {
        content = JSON.parse(content);
    }
    const build = {};
    build.id = uuid.v4();
    build.name = content.name;
    if (!build.name) { build.name = build.id; }
    build.resolution = content.resolution;
    if (!(build.resolution instanceof Array) || build.resolution.length !== 2) {
        build.resolution = [800, 400];
    }
}

function loadServersNBT() {
    return new Promise((resolve, reject) => {
        const serversPath = launcher.getPath('servers.dat');
        if (fs.existsSync(serversPath)) {
            fs.readFile(launcher.getPath('servers.dat'), (err, data) => {
                if (err) reject(err);
                else resolve(ServerInfo.readFromNBT(data));
            });
        } else resolve([]);
    });
}
export default {
    load(context) {
        const serverPromise = loadServersNBT().then((result) => {
            const arr = result.map((s) => {
                const obj = {
                    type: 'server',
                    host: s.host,
                    port: s.port,
                    name: s.name,
                    isLanServer: s.isLanServer,
                    icon: s.icon,
                };
                return obj
            });
            return arr;
        });
        const modpackPromise = new Promise((resolve, reject) => {
            fs.readdir(launcher.getPath('profiles'), (err, files) => {
                if (err) { reject(err); } else { resolve(files); }
            });
        }).then((files) => {
            for (const file of files) {
                const profileRoot = launcher.getPath('profiles', file);
                const json = launcher.getPath('profiles', file, PROFILE_NAME);
                // implement late... no profile now.... lol
            }
        });
        return Promise.all(serverPromise, modpackPromise)
            .then(result => result[0].concat(result[1]))
    },
}

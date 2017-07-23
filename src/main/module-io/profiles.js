import uuid from 'uuid'
import mkdirp from 'mkdirp'
import {
    ServerInfo,
} from 'ts-minecraft'

import launcher from '../launcher'

const fs = require('fs')

const PROFILE_NAME = 'profile.json'

function parseProfile(content) {
    if (typeof content === 'string') {
        content = JSON.parse(content);
    }
    return {
        id: content.id,
        name: content.name,
        version: content.version,
        resourcepacks: content.resourcepacks || [],
        mods: content.mods || [],
        resolution: content.resolution || [800, 400],
        java: content.java,
        vmOptions: content.vmOptions,
        mcOptions: content.mcOptions,
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
    load() {
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
            const profilesRoot = launcher.getPath('profiles');
            if (fs.existsSync(profilesRoot)) {
                fs.readdir(profilesRoot, (err, files) => {
                    if (err) reject(err);
                    else resolve(files);
                });
            } else {
                mkdirp(profilesRoot, (err) => {
                    if (err) reject(err)
                    else resolve()
                }).then(() => [])
            }
        }).then((files) => {
            if (files.length === 0) return [];
            const tasks = [];
            for (const file of files) {
                const profileRoot = launcher.getPath('profiles', file);
                const json = launcher.getPath('profiles', file, PROFILE_NAME);
                if (fs.existsSync(json)) {
                    tasks.push(new Promise((resolve, reject) => {
                        fs.readFile(json, (err, data) => {
                            if (err) reject(err);
                            else resolve(data.toString());
                        })
                    }).then(content => parseProfile(content)));
                }
            }
            return Promise.all(tasks);
        });
        return Promise.all([serverPromise, modpackPromise])
            .then(result => result[0].concat(result[1]));
    },
    save(mutation, state, payload) {
        // if (mutation === 'profiles/add') {

        // }
        console.log(mutation)
    },
}

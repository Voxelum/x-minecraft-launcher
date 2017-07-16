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

function loadServers(context) {
    return new Promise((resolve, reject) => {
        const serversPath = context.getPath('servers.dat');
        if (fs.existsSync(serversPath)) {
            fs.readFile(context.getPath('servers.dat'), (err, data) => {
                if (err) reject(err);
                else resolve(ServerInfo.readFromNBT(data));
            });
        } else resolve([]);
    });
}
export default {
    load(context) {
        return new Promise((resolve, reject) => {
            fs.readdir(launcher.getPath('profiles'), (err, files) => {
                if (err) { reject(err); } else {
                    for (const file of files) {
                        const profileRoot = launcher.getPath('profiles', file);
                        const json = launcher.getPath('profiles', file, PROFILE_NAME);
                    }
                }
            });
            loadServers(context).then((result) => {

            });
            resolve({});
        });
    },
}

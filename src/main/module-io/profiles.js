const fs = require('fs')
import launcher from '../launcher'
const PROFILE_NAME = 'profile.json'

function parse(content) {
    if (typeof content === 'string') {
        content = JSON.parse(content);
    }
    let build = {};
    build.id = v4();
    build.name = content.name;
    if (!build.name) { build.name = build.id; }
    build.resolution = content.resolution;
    if (!build.resolution instanceof Array || build.resolution.length != 2) {
        build.resolution = [800, 400];
    }
}

function loadServers(context) {
    return new Promise((resolve, reject) => {
        let serversPath = context.getPath('servers.dat');
        if (fs.existsSync(serversPath)) {
            fs.readFile(context.getPath('servers.dat'), (err, data) => {
                if (err) reject(err);
                else resolve(ServerInfo.readFromNBT(data));
            });
        }
        else resolve([]);
    });

}
export default {
    load(context) {
        return new Promise((resolve, reject) => {
            fs.readdir(launcher.getPath('profiles'), (err, files) => {
                if (err) { reject(err); }
                else {
                    for (let file of files) {
                        let profileRoot = launcher.getPath('profiles', file);
                        let json = launcher.getPath('profiles', file, PROFILE_NAME);
                    }
                }
            });
            loadServers(context).then(result => {

            });
            resolve({});
        });
    }
}
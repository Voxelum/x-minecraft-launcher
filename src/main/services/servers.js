const {
    ServerInfo
} = require('ts-minecraft')
const fs = require('fs')
export default {
    ping: ServerInfo.fetchServerStatus,
}
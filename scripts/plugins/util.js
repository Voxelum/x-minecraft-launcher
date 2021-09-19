
const queryRE = /\?.*$/
const hashRE = /#.*$/

const cleanUrl = (url) =>
  url.replace(hashRE, '').replace(queryRE, '')

module.exports = { cleanUrl }

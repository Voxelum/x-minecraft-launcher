import launcher from '../launcher'

export default {
    // query: launcher.query,
    query(context, payload) {
        console.log('call query!')
        return launcher.query(payload.service, payload.action, payload.payload)
    },
}

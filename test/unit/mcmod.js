import mocha from 'mocha'
import assert from 'assert'
import mcmod from '../../src/main/services/mcmod'

describe('Mcmod serivce', () => {
    it('should fetch the welcome page data', (done) => {
        mcmod.actions.fetchAll()
            .then((data) => {
                assert(data.content)
                assert(data.news)
                done()
            })
            .catch((e) => { done(e) })
    })
})

describe('Fetch detail', () => {
    it('should fetch details from mcmod.cn', (done) => {
        mcmod.actions.fetchDetail({}, '')
            .then(
                /**
                 */
            (data) => {
                assert.equal(data.author, '')
                
                done()
            })
            .catch((e) => { done(e) })
    })
})



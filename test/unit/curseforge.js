import mocha from 'mocha'
import assert from 'assert'
import curseforge from '../../src/main/services/curseforge'

describe('Fetch detail', () => {
    it('should test project.image is not null and a valid string', (done) => {
        curseforge.actions.project({}, '/journeymap')               
            .then(
            (data) => {
                assert.equal(data.image, 'https://media-elerium.cursecdn.com/avatars/thumbnails/9/144/62/62/635421614078544069.png')
                assert.equal(data.name, 'JourneyMap')
                assert.equal(data.createdDate, 'Sep 19, 2011')
                assert.equal(data.lastFile, 'Nov 8, 2017')
                assert.equal(data.totalDownload, '26,475,885')
                assert.equal(data.license, '/projects/journeymap/license')
                assert(typeof description === 'string')
                done()
            })
            .catch((e) => { done(e) })
    })
})

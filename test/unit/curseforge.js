import mocha from 'mocha'
import assert from 'assert'

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

describe('Fetch detail', () => {
    it('should test project.image is not null and a valid string', (done) => {
        curseforge.actions.project({}, '/mantle')               
            .then(
            (data) => {
                assert.equal(data.image, 'https://media-elerium.cursecdn.com/avatars/thumbnails/5/796/62/62/635351433944342580.png')
                assert.equal(data.name, 'Mantle')
                assert.equal(data.createdDate, 'Feb 22, 2014')
                assert.equal(data.lastFile, 'Sep 1, 2017')
                assert.equal(data.totalDownload, '23,980,826')
                assert.equal(data.license, '/projects/mantle/license')
                assert(typeof description === 'string')
                done()
            })
            .catch((e) => { done(e) })
    })
})

describe('Fetch detail', () => {
    it('should test project.image is not null and a valid string', (done) => {
        curseforge.actions.project({}, '/chisel')               
            .then(
            (data) => {
                assert.equal(data.image, 'https://media-elerium.cursecdn.com/avatars/thumbnails/24/517/62/62/635758617021943603.png')
                assert.equal(data.name, 'Chisel')
                assert.equal(data.createdDate, 'Aug 22, 2015')
                assert.equal(data.lastFile, 'Sep 12, 2017')
                assert.equal(data.totalDownload, '17,421,946')
                assert.equal(data.license, '/projects/chisel/license')
                assert(typeof description === 'string')
                done()
            })
            .catch((e) => { done(e) })
    })
})


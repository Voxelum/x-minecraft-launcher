import mocha from 'mocha'
import assert from 'assert'
import mcmod from '../../src/main/services/mcmod'

// describe('Mcmod serivce', () => {
//     it('should fetch the welcome page data', (done) => {
//         mcmod.actions.fetchAll()
//             .then((data) => {
//                 assert(data.content)
//                 assert(data.news)
//                 done()
//             })
//             .catch((e) => { done(e) })
//     })
// })

describe('Fetch detail', () => {
    it('should fetch details from mcmod.cn for MineFactoryReloaded 2', (done) => {
        mcmod.actions.fetchDetail({}, 'http://www.mcmod.cn/class/32.html')
            .then(
                /**
                 */
            (data) => {
                assert.equal(data.title, '[MFR2] 我的工厂2')
                assert.equal(data.subTitle, 'MineFactoryReloaded 2')
                // assert.equal(data.likes, '')
                assert.equal(data.popularity, '3.5')
                assert.equal(data.popularityType, '众人皆知')
                assert.equal(data.lastDayCount, '昨日指数：175')
                assert.equal(data.averageCount, '昨日平均指数：24.038')
                assert.equal(data.browseCount, '19.97万')
                assert.equal(data.recommendCount, '88')
                assert.equal(data.image, 'http://www.mcmod.cn/pages/center/0/album/20141012/14130445467317.png')
                assert.equal(data.modType, '综合类')
                assert.equal(data.recordTime, '收录时间：4年前')
                assert.equal(data.author, 'TeamCoFH')
                assert.equal(data.lastModifiedTime, '最后编辑：3月前')
                assert.equal(data.mod, '模式：SSP/SMP')
                assert.equal(data.lastRecommendTime, '最后推荐：1天前')
                assert.equal(data.modifyCount, '历史编辑： 3次')
                assert.equal(data.relevantLink[0], 'http://www.mcmod.cn/jump/aHR0cDovL3RlYW1jb2ZoLmNvbS8=')
                // assert.equal(data.modDescription, '')
                done()
            })
            .catch((e) => { done(e) })
    })
})

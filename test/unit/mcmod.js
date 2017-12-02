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
                // assert.equal(data.likes, '88')
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
                assert.equal(data.modifyCount, '历史编辑：3次')
                assert.equal(data.relevantLink[0], 'http://www.mcmod.cn/jump/aHR0cDovL3RlYW1jb2ZoLmNvbS8=')
                // assert.equal(data.modDescription, '')
                done()
            })
            .catch((e) => { done(e) })
    })
})

describe('Fetch detail', () => {
    it('should fetch details from mcmod.cn for GregTech5', (done) => {
        mcmod.actions.fetchDetail({}, 'http://www.mcmod.cn/class/327.html')
            .then(
                /**
                 */
            (data) => {
                assert.equal(data.title, '[GT5] 格雷科技5')
                assert.equal(data.subTitle, 'GregTech5')
                // assert.equal(data.likes, '697')
                assert.equal(data.popularity, '5.0')
                assert.equal(data.popularityType, '名扬天下')
                assert.equal(data.lastDayCount, '昨日指数：242')
                assert.equal(data.averageCount, '昨日平均指数：24.038')
                assert.equal(data.browseCount, '17.32万')
                assert.equal(data.recommendCount, '697')
                assert.equal(data.image, 'http://i.mcmod.cn/class/cover/20171127/1511779237_11798_7HYz.jpg')
                assert.equal(data.modType, '综合类')
                assert.equal(data.recordTime, '收录时间：3年前')
                assert.equal(data.author, '作者/开发团队：GregoriusT,BloodAsp')
                assert.equal(data.lastModifiedTime, '最后编辑：4天前')
                assert.equal(data.mod, '模式：SSP/SMP')
                assert.equal(data.lastRecommendTime, '最后推荐：8时前')
                assert.equal(data.modifyCount, '历史编辑：21次')
                assert.equal(data.relevantLink[0], 'http://www.mcmod.cn/jump/aHR0cDovL2Z0Yi5nYW1lcGVkaWEuY29tL0dyZWdUZWNoXzVfVW5vZmZpY2lhbA==')
                assert.equal(data.relevantLink[1], 'http://www.mcmod.cn/jump/aHR0cDovL21vZHMuY3Vyc2UuY29tL21jLW1vZHMvbWluZWNyYWZ0LzI1MTA1My1ncmVndGVjaC01LXVub2ZmaWNpYWw=')
                assert.equal(data.relevantLink[2], 'http://www.mcmod.cn/jump/aHR0cDovL2dpdGh1Yi5jb20vQmxvb2QtQXNwL0dUNS1Vbm9mZmljaWFs')
                // assert.equal(data.modDescription, '')
                done()
            })
            .catch((e) => { done(e) })
    })
})

describe('Fetch detail', () => {
    it('should fetch details from mcmod.cn for Big Reactors', (done) => {
        mcmod.actions.fetchDetail({}, 'http://www.mcmod.cn/class/257.html')
            .then(
                /**
                 */
            (data) => {
                assert.equal(data.title, '[BR] 大型反应堆')
                assert.equal(data.subTitle, 'Big Reactors')
                // assert.equal(data.likes, '697')
                assert.equal(data.popularity, '1.0')
                assert.equal(data.popularityType, '默默无闻')
                assert.equal(data.lastDayCount, '昨日指数：59')
                assert.equal(data.averageCount, '昨日平均指数：24.038')
                assert.equal(data.browseCount, '4.63万')
                assert.equal(data.recommendCount, '37')
                assert.equal(data.image, 'http://www.mcmod.cn/pages/center/0/album/20140819/14084402196068.jpg')
                assert.equal(data.modType, '综合类')
                assert.equal(data.recordTime, '收录时间：3年前')
                assert.equal(data.author, '作者/开发团队：Erogenous Beef')
                assert.equal(data.lastModifiedTime, '最后编辑：5天前')
                assert.equal(data.mod, '模式：SSP/SMP')
                assert.equal(data.lastRecommendTime, '最后推荐：46分前')
                assert.equal(data.modifyCount, '历史编辑：3次')
                assert.equal(data.relevantLink[0], 'http://www.mcmod.cn/jump/aHR0cDovL2JpZy1yZWFjdG9ycy5jb20v')
                assert.equal(data.relevantLink[1], 'http://www.mcmod.cn/jump/aHR0cDovL3dpa2kudGVjaG5pY3BhY2submV0L0JpZ19SZWFjdG9ycw==')
                assert.equal(data.relevantLink[2], 'http://www.mcmod.cn/jump/aHR0cHM6Ly9naXRodWIuY29tL2Vyb2dlbm91c2JlZWYvQmlnUmVhY3RvcnM=')
                // assert.equal(data.modDescription, '')
                done()
            })
            .catch((e) => { done(e) })
    })
})



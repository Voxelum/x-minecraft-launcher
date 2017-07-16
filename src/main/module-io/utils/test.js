import Repository from './repository'

const repo = new Repository('C:\\Users\\CIJhn\\Desktop')
repo.add('C:\\Users\\CIJhn\\Desktop\\liteloader-1.12-SNAPSHOT-release.jar').then((res) => {
    console.log(res)
})

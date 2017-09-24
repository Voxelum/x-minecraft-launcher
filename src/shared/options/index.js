import levels from './levels'
import tempate from './default'

export default Object.keys(levels).map(level => ({
    ...JSON.stringify(JSON.parse(tempate)),
    ...levels[level],
}))

import levels from './levels';
import tempate from './default';

export default Object.keys(levels).map(level => ({
    ...JSON.parse(JSON.stringify(tempate)),
    ...levels[level],
}));

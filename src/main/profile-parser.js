import { v4 } from 'uuid'
export default {
    parse(content) {
        if (typeof content === 'string')
            content = JSON.parse(content)
        let build = {};
        build.id = v4()
        build.name = content.name
        if (!build.name) build.name = build.id
        build.resolution = content.resolution;
        if (!build.resolution instanceof Array || build.resolution.length != 2)
            build.resolution = [800, 400]
        
    }
}
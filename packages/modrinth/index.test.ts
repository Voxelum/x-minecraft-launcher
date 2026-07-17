import { MockAgent, fetch as _fetch } from 'undici'
import { describe, expect, it } from 'vitest'
import { ModerinthApiError, ModrinthV2Client } from './index'

describe('ModrinthV2Client', () => {
  const agent = new MockAgent()
  agent.disableNetConnect()
  const fetch: typeof globalThis.fetch = (input, init) => {
    init = Object.assign(init || {}, {
      dispatcher: agent,
    })
    return _fetch(input as any, init as any) as any
  }

  describe('#searchProjects', () => {
    it('should be able to search projects with defaults', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/search?query=&filter=&index=downloads&offset=0&limit=10',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.searchProjects({})).resolves.toEqual({ data: 'hello' })
    })
    it('should be able to search projects with options', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/search?query=123&filter=44&index=downloads&offset=19&limit=100&facets=%5B%5B%22categories%3Aforge%22%5D%2C%5B%22versions%3A1.17.1%22%5D%2C%5B%22project_type%3Amod%22%5D%5D',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(
        client.searchProjects({
          index: 'downloads',
          limit: 100,
          offset: 19,
          query: '123',
          filter: '44',
          facets: '[["categories:forge"],["versions:1.17.1"],["project_type:mod"]]',
        }),
      ).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if search failed', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/search?query=&filter=&index=downloads&offset=0&limit=10',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.searchProjects({})).rejects.toThrow(ModerinthApiError)
    })
  })
  describe('#getProject', () => {
    it('should be able to get project', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/project/123',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProject('123')).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/project/123',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProject('123')).rejects.toThrow(ModerinthApiError)
    })
  })
  describe('#createProject', () => {
    it('uploads an empty project as draft without submitting it for review', async () => {
      let requestBody: FormData | undefined
      const multipartFetch: typeof globalThis.fetch = async (_input, init) => {
        requestBody = init?.body as FormData
        return new Response(JSON.stringify({ id: 'project1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      const client = new ModrinthV2Client({ fetch: multipartFetch })
      await client.createProject({
        slug: 'my-pack',
        title: 'My Pack',
        description: 'Short summary',
        body: 'Long description',
        client_side: 'required',
        server_side: 'optional',
        project_type: 'modpack',
        initial_versions: [],
        categories: ['adventure'],
        license_id: 'ARR',
        status: 'draft',
        requested_status: 'private',
      }, { fileName: 'icon.png', data: new Blob(['icon'], { type: 'image/png' }) })

      expect(JSON.parse(requestBody?.get('data') as string)).toMatchObject({
        description: 'Short summary',
        body: 'Long description',
        status: 'draft',
        requested_status: 'draft',
        is_draft: true,
        license_id: 'LicenseRef-All-Rights-Reserved',
      })
      expect((requestBody?.get('icon') as File).name).toBe('icon.png')
    })

    it('updates a project icon with the selected extension and mime type', async () => {
      let requestUrl = ''
      let requestInit: RequestInit | undefined
      const patchFetch: typeof globalThis.fetch = async (input, init) => {
        requestUrl = input.toString()
        requestInit = init
        return new Response(undefined, { status: 204 })
      }
      const client = new ModrinthV2Client({ fetch: patchFetch })
      await client.updateProjectIcon('project1', new Blob(['icon'], { type: 'image/png' }), '.png')

      expect(requestUrl).toBe('https://api.modrinth.com/v2/project/project1/icon?ext=png')
      expect(requestInit?.method).toBe('PATCH')
      expect((requestInit?.headers as Record<string, string>)['content-type']).toBe('image/png')
    })

    it('adds, updates, and deletes project gallery images with query metadata', async () => {
      const requests: Array<{ url: string; method: string | undefined }> = []
      const galleryFetch: typeof globalThis.fetch = async (input, init) => {
        requests.push({ url: input.toString(), method: init?.method })
        return new Response(undefined, { status: 204 })
      }
      const client = new ModrinthV2Client({ fetch: galleryFetch })
      const imageUrl = 'https://cdn.modrinth.com/data/project1/images/gallery.png'
      await client.addProjectGalleryImage('project1', new Blob(['image'], { type: 'image/png' }), '.png', { featured: true, title: 'Preview', ordering: 0 })
      await client.updateProjectGalleryImage('project1', imageUrl, { featured: false, description: 'Updated' })
      await client.deleteProjectGalleryImage('project1', imageUrl)

      expect(requests).toEqual([
        { url: 'https://api.modrinth.com/v2/project/project1/gallery?ext=png&featured=true&title=Preview&ordering=0', method: 'POST' },
        { url: `https://api.modrinth.com/v2/project/project1/gallery?url=${encodeURIComponent(imageUrl)}&featured=false&description=Updated`, method: 'PATCH' },
        { url: `https://api.modrinth.com/v2/project/project1/gallery?url=${encodeURIComponent(imageUrl)}`, method: 'DELETE' },
      ])
    })
  })
  describe('#getProjectVersions', () => {
    it('should be able to get project versions', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/project/123/version',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersions('123')).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/project/123/version',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersions('123')).rejects.toThrow(ModerinthApiError)
    })
    it('should be able to get project versions with options', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/project/123/version?loaders=%5B%22forge%22%5D&game_versions=%5B%221.22%22%5D&featured=true',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(
        client.getProjectVersions('123', {
          loaders: ['forge'],
          gameVersions: ['1.22'],
          featured: true,
        }),
      ).resolves.toEqual({ data: 'hello' })
    })
  })
  describe('#getProjectVersion', () => {
    it('should be able to get project version', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/version/123',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersion('123')).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/version/123',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersion('123')).rejects.toThrow(ModerinthApiError)
    })
  })
  describe('#createVersion', () => {
    it('uploads all files in one multipart request and marks the primary file', async () => {
      let requestBody: FormData | undefined
      const multipartFetch: typeof globalThis.fetch = async (_input, init) => {
        requestBody = init?.body as FormData
        return new Response(JSON.stringify({ id: 'version1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      const client = new ModrinthV2Client({ fetch: multipartFetch })
      await client.createVersion({
        name: '1.0.0',
        version_number: '1.0.0',
        game_versions: ['1.21.1'],
        version_type: 'release',
        loaders: ['fabric'],
        project_id: 'project1',
        status: 'draft',
      }, [
        { partName: 'universal', fileName: 'pack-1.0.0.mrpack', data: new Blob(['universal']) },
        { partName: 'client', fileName: 'pack-client-1.0.0.mrpack', data: new Blob(['client']) },
        { partName: 'server', fileName: 'pack-server-1.0.0.mrpack', data: new Blob(['server']) },
      ], 'universal')

      expect(JSON.parse(requestBody?.get('data') as string)).toMatchObject({
        file_parts: ['universal', 'client', 'server'],
        primary_file: 'universal',
        featured: false,
        status: 'draft',
      })
      expect((requestBody?.get('client') as File).name).toBe('pack-client-1.0.0.mrpack')
    })

    it('rejects a missing primary file before sending the request', async () => {
      const client = new ModrinthV2Client({ fetch })
      await expect(client.createVersion({
        name: '1.0.0',
        version_number: '1.0.0',
        game_versions: ['1.21.1'],
        version_type: 'release',
        loaders: ['fabric'],
        project_id: 'project1',
      }, [
        { partName: 'client', fileName: 'pack-client-1.0.0.mrpack', data: new Blob(['client']) },
      ], 'universal')).rejects.toThrow('Primary file part does not exist')
    })

    it('submits a draft through requested_status', async () => {
      let requestBody = ''
      const patchFetch: typeof globalThis.fetch = async (_input, init) => {
        requestBody = init?.body as string
        return new Response(undefined, { status: 204 })
      }
      const client = new ModrinthV2Client({ fetch: patchFetch })
      await client.updateVersion('version1', { requested_status: 'listed' })
      expect(JSON.parse(requestBody)).toEqual({ requested_status: 'listed' })
    })
  })
  describe('#getProjectVersionsById', () => {
    it('should be able to get project versions by id', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/versions?ids=%5B%22abcd1234%22%2C%22EFGH5678%22%5D',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersionsById(['abcd1234', 'EFGH5678'])).resolves.toEqual({
        data: 'hello',
      })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/versions?ids=%5B%22abcd1234%22%2C%22EFGH5678%22%5D',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersionsById(['abcd1234', 'EFGH5678'])).rejects.toThrow(ModerinthApiError)
    })
    it('filters out non-modrinth ids (e.g. leaked file paths) and returns [] if nothing remains', async () => {
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersionsById(['C:\\path\\to\\file.jar', '123'])).resolves.toEqual([])
    })
  })
  describe('#getProjectVersionsByHash', () => {
    it('should be able to get project versions by hash', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          method: 'POST',
          path: '/v2/version_files',
          body: JSON.stringify({ hashes: ['123', '345'], algorithm: 'sha1' }),
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersionsByHash(['123', '345'])).resolves.toEqual({
        data: 'hello',
      })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          method: 'POST',
          path: '/v2/version_files',
          body: JSON.stringify({ hashes: ['123', '345'], algorithm: 'sha1' }),
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersionsByHash(['123', '345'])).rejects.toThrow(
        ModerinthApiError,
      )
    })
    it('should be able to set algorithm', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          method: 'POST',
          path: '/v2/version_files',
          body: JSON.stringify({ hashes: ['123', '345'], algorithm: 'sha256' }),
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectVersionsByHash(['123', '345'], 'sha256')).resolves.toEqual({
        data: 'hello',
      })
    })
  })
  describe('#getLatestProjectVersion', () => {
    it('should be able to get latest project version', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          method: 'POST',
          path: '/v2/version_file/123/update?algorithm=sha1',
          body: JSON.stringify({ loaders: [], game_versions: [] }),
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getLatestProjectVersion('123')).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          method: 'POST',
          path: '/v2/version_file/123/update?algorithm=sha1',
          body: JSON.stringify({ loaders: [], game_versions: [] }),
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getLatestProjectVersion('123')).rejects.toThrow(ModerinthApiError)
    })
    it('should be able to set options', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          method: 'POST',
          path: '/v2/version_file/123/update?algorithm=sha1',
          body: JSON.stringify({ loaders: ['forge'], game_versions: ['1.22'] }),
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(
        client.getLatestProjectVersion('123', { loaders: ['forge'], gameVersions: ['1.22'] }),
      ).resolves.toEqual({ data: 'hello' })
    })
  })
  describe('#getLicenseTags', () => {
    it('should be able to get license tags', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/tag/license',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getLicenseTags()).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/tag/license',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getLicenseTags()).rejects.toThrow(ModerinthApiError)
    })
  })
  describe('#getCategoryTags', () => {
    it('should be able to get category tags', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/tag/category',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getCategoryTags()).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/tag/category',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getCategoryTags()).rejects.toThrow(ModerinthApiError)
    })
  })
  describe('#getGameVersionTags', () => {
    it('should be able to get game version tags', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/tag/game_version',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getGameVersionTags()).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/tag/game_version',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getGameVersionTags()).rejects.toThrow(ModerinthApiError)
    })
  })
  describe('#getLoaderTags', () => {
    it('should be able to get loader tags', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/tag/loader',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getLoaderTags()).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/tag/loader',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getLoaderTags()).rejects.toThrow(ModerinthApiError)
    })
  })
  describe('#getProjectTeamMembers', () => {
    it('should be able to get project team members', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/project/123/members',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectTeamMembers('123')).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if project not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/project/123/members',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getProjectTeamMembers('123')).rejects.toThrow(ModerinthApiError)
    })
  })
  describe('#getUser', () => {
    it('should be able to get user', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/user/123',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getUser('123')).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if user not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/user/123',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getUser('123')).rejects.toThrow(ModerinthApiError)
    })
  })
  describe('#getUserProjects', () => {
    it('should be able to get user projects', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/user/123/projects',
        })
        .reply(200, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getUserProjects('123')).resolves.toEqual({ data: 'hello' })
    })
    it('should throw error if user not found', async () => {
      const mockPool = agent.get('https://api.modrinth.com')
      mockPool
        .intercept({
          path: '/v2/user/123/projects',
        })
        .reply(404, { data: 'hello' })
      const client = new ModrinthV2Client({ fetch })
      await expect(client.getUserProjects('123')).rejects.toThrow(ModerinthApiError)
    })
  })
})

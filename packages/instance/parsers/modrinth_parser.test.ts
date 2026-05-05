import { describe, it, expect } from 'vitest'
import { type Project, type ProjectVersion, type ModrinthProfile } from './modrinth_parser'

describe('Modrinth Parser', () => {
  describe('Type Definitions', () => {
    describe('Project', () => {
      it('should have proper project structure', () => {
        const project: Project = {
          id: 'test-project-id',
          title: 'Test Modpack',
          description: 'A test modpack for testing purposes',
        }

        expect(project.id).toBe('test-project-id')
        expect(project.title).toBe('Test Modpack')
        expect(project.description).toBe('A test modpack for testing purposes')
      })
    })

    describe('ProjectVersion', () => {
      it('should have proper version structure', () => {
        const version: ProjectVersion = {
          id: 'version-123',
          project_id: 'project-456',
          name: 'v1.0.0',
          files: [
            {
              hashes: {
                sha1: 'abc123def456',
                sha256: 'def456ghi789',
              },
              url: 'https://cdn.modrinth.com/data/test/versions/test.jar',
              filename: 'test-mod.jar',
              primary: true,
              size: 1024,
            },
          ],
        }

        expect(version.id).toBe('version-123')
        expect(version.project_id).toBe('project-456')
        expect(version.name).toBe('v1.0.0')
        expect(version.files).toHaveLength(1)
        expect(version.files[0].filename).toBe('test-mod.jar')
        expect(version.files[0].primary).toBe(true)
        expect(version.files[0].size).toBe(1024)
      })

      it('should support multiple files per version', () => {
        const version: ProjectVersion = {
          id: 'version-multi',
          project_id: 'project-multi',
          name: 'v2.0.0',
          files: [
            {
              hashes: { sha1: 'hash1', sha256: 'hash1-256' },
              url: 'https://example.com/file1.jar',
              filename: 'main-mod.jar',
              primary: true,
              size: 2048,
            },
            {
              hashes: { sha1: 'hash2', sha256: 'hash2-256' },
              url: 'https://example.com/file2.jar',
              filename: 'addon.jar',
              primary: false,
              size: 512,
            },
          ],
        }

        expect(version.files).toHaveLength(2)
        expect(version.files[0].primary).toBe(true)
        expect(version.files[1].primary).toBe(false)
      })
    })

    describe('ModrinthProfile', () => {
      it('should have proper profile structure', () => {
        const profile: ModrinthProfile = {
          install_stage: 'installed',
          path: 'test-instance',
          metadata: {
            name: 'Test Instance',
            icon: 'test-icon.png',
            groups: ['Testing'],
            game_version: '1.19.2',
            loader: 'fabric',
            loader_version: {
              id: '0.14.21',
              url: 'https://meta.fabricmc.net/v2/versions/loader/0.14.21',
              stable: true,
            },
            date_created: '2023-01-01T00:00:00Z',
            date_modified: '2023-01-02T00:00:00Z',
            last_played: '2023-01-02T12:00:00Z',
            submitted_time_played: 3600,
            recent_time_played: 1800,
          },
          modrinth_update_version: 'latest',
          projects: {},
        }

        expect(profile.install_stage).toBe('installed')
        expect(profile.path).toBe('test-instance')
        expect(profile.metadata.name).toBe('Test Instance')
        expect(profile.metadata.loader).toBe('fabric')
        expect(profile.metadata.loader_version.id).toBe('0.14.21')
        expect(profile.metadata.loader_version.stable).toBe(true)
      })

      it('should support different loaders', () => {
        const loaders = ['fabric', 'forge', 'quilt', 'neoforge']

        loaders.forEach((loader) => {
          const profile: ModrinthProfile = {
            install_stage: 'installed',
            path: `${loader}-instance`,
            metadata: {
              name: `${loader} Instance`,
              icon: '',
              groups: [],
              game_version: '1.19.2',
              loader,
              loader_version: {
                id: '1.0.0',
                url: `https://example.com/${loader}`,
                stable: true,
              },
              date_created: new Date().toISOString(),
              date_modified: new Date().toISOString(),
              last_played: new Date().toISOString(),
              submitted_time_played: 0,
              recent_time_played: 0,
            },
            modrinth_update_version: 'latest',
            projects: {},
          }

          expect(profile.metadata.loader).toBe(loader)
        })
      })

      it('should support linked data for modpack tracking', () => {
        const profile: ModrinthProfile = {
          install_stage: 'installed',
          path: 'linked-instance',
          metadata: {
            name: 'Linked Instance',
            icon: '',
            groups: [],
            game_version: '1.19.2',
            loader: 'fabric',
            loader_version: {
              id: '0.14.21',
              url: 'https://meta.fabricmc.net/v2/versions/loader/0.14.21',
              stable: true,
            },
            linked_data: {
              project_id: 'test-modpack-id',
              version_id: 'test-version-id',
              locked: false,
            },
            date_created: new Date().toISOString(),
            date_modified: new Date().toISOString(),
            last_played: new Date().toISOString(),
            submitted_time_played: 0,
            recent_time_played: 0,
          },
          modrinth_update_version: 'latest',
          projects: {},
        }

        expect(profile.metadata.linked_data).toBeDefined()
        expect(profile.metadata.linked_data?.project_id).toBe('test-modpack-id')
        expect(profile.metadata.linked_data?.version_id).toBe('test-version-id')
        expect(profile.metadata.linked_data?.locked).toBe(false)
      })

      it('should support project files with metadata', () => {
        const profile: ModrinthProfile = {
          install_stage: 'installed',
          path: 'project-instance',
          metadata: {
            name: 'Project Instance',
            icon: '',
            groups: [],
            game_version: '1.19.2',
            loader: 'fabric',
            loader_version: {
              id: '0.14.21',
              url: 'https://meta.fabricmc.net/v2/versions/loader/0.14.21',
              stable: true,
            },
            date_created: new Date().toISOString(),
            date_modified: new Date().toISOString(),
            last_played: new Date().toISOString(),
            submitted_time_played: 0,
            recent_time_played: 0,
          },
          modrinth_update_version: 'latest',
          projects: {
            'mods/test-mod.jar': {
              sha512: 'abc123def456',
              disabled: false,
              file_name: 'test-mod.jar',
              metadata: {
                type: 'mod',
                project: {
                  id: 'test-project',
                  title: 'Test Mod',
                  description: 'A test mod',
                },
                version: {
                  id: 'test-version',
                  project_id: 'test-project',
                  name: 'v1.0.0',
                  files: [],
                },
                update_version: null,
                incompatible: false,
              },
            },
          },
        }

        const projectFile = profile.projects['mods/test-mod.jar']
        expect(projectFile).toBeDefined()
        expect(projectFile.sha512).toBe('abc123def456')
        expect(projectFile.disabled).toBe(false)
        expect(projectFile.file_name).toBe('test-mod.jar')
        expect(projectFile.metadata.type).toBe('mod')
        expect(projectFile.metadata.project.id).toBe('test-project')
        expect(projectFile.metadata.incompatible).toBe(false)
      })
    })
  })

  describe('Loader Version Structure', () => {
    it('should validate loader version structure', () => {
      const loaderVersions = [
        {
          id: '0.14.21',
          url: 'https://meta.fabricmc.net/v2/versions/loader/0.14.21',
          stable: true,
        },
        {
          id: '43.2.0',
          url: 'https://files.minecraftforge.net/maven/net/minecraftforge/forge/1.19.2-43.2.0',
          stable: true,
        },
        {
          id: '0.19.2',
          url: 'https://quiltmc.org/api/v1/versions/loader/0.19.2',
          stable: false,
        },
      ]

      loaderVersions.forEach((version) => {
        expect(version.id).toBeTruthy()
        expect(version.url).toMatch(/^https?:\/\//)
        expect(typeof version.stable).toBe('boolean')
      })
    })
  })
})

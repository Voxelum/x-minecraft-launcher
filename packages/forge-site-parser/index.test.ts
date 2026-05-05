import * as path from 'path'
import { parse } from './index'
import { promises } from 'fs'
import { describe, test, expect } from 'vitest'

describe('ForgeWebpage', () => {
  describe('#parse', () => {
    test('should parse forge site', async ({ mock }) => {
      const content = await promises.readFile(path.join(mock, 'sample-forge.html'))
      const page = parse(content.toString())
      expect(page).toBeTruthy()
      expect(page.versions).toHaveLength(4)
      expect(page.mcversion).toEqual('1.14.4')
      for (const ver of page.versions) {
        expect(ver.type).toBeTruthy()
        expect(ver.version).toBeTruthy()

        expect(ver.installer!.sha1).toBeTruthy()
        expect(ver.installer!.path).toBeTruthy()
        expect(ver.installer!.md5).toBeTruthy()
      }
      let ver = page.versions[page.versions.length - 2]
      expect(ver.installer!.md5).toEqual('2d24a32cce228d4cf3c42caf2e3cfe37')
      expect(ver.version).toEqual('28.0.4')
      expect(ver.installer!.sha1).toEqual('80ffade96232940422cbaf218ce6d424fd9192f2')
      expect(ver.installer!.path).toEqual(
        'http://files.minecraftforge.net/maven/net/minecraftforge/forge/1.14.4-28.0.4/forge-1.14.4-28.0.4-installer.jar',
      )

      ver = page.versions[page.versions.length - 1]
      expect(ver.installer!.md5).toEqual('325158d1f128d18e78decd624340f707')
      expect(ver.installer!.sha1).toEqual('5d52ef70aa57d00a1c75c36314cc4dff946f8320')
      expect(ver.version).toEqual('36.1.3')
      expect(ver.installer!.path).toEqual(
        '/maven/net/minecraftforge/forge/1.16.5-36.1.3/forge-1.16.5-36.1.3-installer.jar',
      )
    })

    test('should parse new forge site', async ({ mock }) => {
      const content = await promises.readFile(path.join(mock, 'sample-forge-new.html'))
      const page = parse(content.toString())
      expect(page).toBeTruthy()

      expect(page.versions).toHaveLength(3)
      expect(page.mcversion).toEqual('1.20.1')

      for (const ver of page.versions) {
        expect(ver.type).toBeTruthy()
        expect(ver.version).toBeTruthy()

        expect(ver.installer!.sha1).toBeTruthy()
        expect(ver.installer!.path).toBeTruthy()
        expect(ver.installer!.md5).toBeTruthy()
      }
    })
  })

  // describe("#getWebPage", () => {
  //     test("Get Latest", async () => {
  //         mockNet.getIfUpdate.mockReturnValue(Promise.resolve({
  //             timestamp: "0",
  //         }));
  //         const page = await getWebPage();

  //         expect(page).toBeTruthy();
  //         expect(mockNet.getIfUpdate).toHaveBeenCalled();
  //         expect(mockNet.getIfUpdate).toHaveBeenCalledWith("http://files.minecraftforge.net/maven/net/minecraftforge/forge/index.html", ForgeWebPage.parse, undefined);

  //     });
  //     test("Get Specific version", async () => {
  //         mockNet.getIfUpdate.mockReturnValue(Promise.resolve({
  //             timestamp: "0",
  //         }));
  //         const page = await getWebPage({ mcversion: "1.12.2" });

  //         expect(page).toBeTruthy();
  //         expect(mockNet.getIfUpdate).toHaveBeenCalled();
  //         expect(mockNet.getIfUpdate).toHaveBeenCalledWith("http://files.minecraftforge.net/maven/net/minecraftforge/forge/index_1.12.2.html",
  //             ForgeWebPage.parse, undefined);
  //     });
  // });
})

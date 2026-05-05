import * as path from 'path'
import { queryStatus, Status } from './index'
import { describe, test, expect } from 'vitest'

describe('Server', () => {
  const root = path.normalize(path.join(__dirname, '..', '..', 'mock'))
  describe('Ping', () => {
    // testContext.slow(3000);
    // test("should fetch server frame", async () => {
    //     const frame = await queryStatus({ host: "mc.hypixel.net" });
    //     expect(frame);
    //     expect(frame.ping !== -1).toBeTruthy();
    // });
    // test("should control the port", async () => {
    //     await expect(queryStatus({ host: "mc.hypixel.net", port: 138 }, { timeout: 500, retryTimes: 0 }))
    //         .rejects
    //         .toBeTruthy();
    // });
    test('should capture timeout exception', async () => {
      await expect(
        queryStatus(
          {
            host: 'crafterr.me',
          },
          { timeout: 100 },
        ),
      ).rejects.toBeTruthy()
    })
    // test("should fetch server info and ping", async () => {
    //     const status = await queryStatus({
    //         host: "mc.hypixel.net",
    //     }, { timeout: 10000 });
    //     expect(typeof status === "object").toBeTruthy();
    //     expect((typeof status.description === "object") || (typeof status.description === "string")).toBeTruthy();
    //     expect(status.ping).not.toEqual(-1);
    // });
  })
})

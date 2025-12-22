import { LauncherAppPlugin } from '~/app'
import { LaunchService } from '~/launch'
import { kSettings } from '~/settings'

export const pluginDiscreteGPULinux: LauncherAppPlugin = async (app) => {
  app.registry.get(LaunchService).then((servi) => {
    servi.registerMiddleware({
      name: 'discrete-gpu-linux',
      async onBeforeLaunch(input, payload) {
        if (app.platform.os !== 'linux') return
        if (payload.side === 'server') return
        const ops = payload.options
        const settings = await app.registry.get(kSettings)
        if (settings.enableDedicatedGPUOptimization) {
          const env = ops.extraExecOption?.env || {
            ...process.env,
          }
          const info = (await app.host.getGPUInfo('basic'))

          function sortGPUsByDiscreteLikelihood() {
            if (!info || !(info as any).gpuDevice || (info as any).gpuDevice.length === 0) {
              return []
            }
            const devices = [...(info as any).gpuDevice]; // 创建副本避免修改原数组
            const aux = (info as any).auxAttributes || {};

            // 为每个设备计算“独显可能性分数”
            devices.forEach(device => {
              let score = 0;
              const vendorIdHex = '0x' + device.vendorId.toString(16).padStart(4, '0');

              // 1. 基础Vendor ID评分
              if (vendorIdHex === '0x10DE') {
                score += 100; // NVIDIA，极大概率是独显
              } else if (vendorIdHex === '0x1002') {
                score += 50;  // AMD，可能是独显（也可能是核显）
              } else if (vendorIdHex === '0x8086') {
                score += 0;   // Intel，极大概率是核显
              } else {
                score += 10;  // 其他厂商（如Qualcomm, Apple），默认给较低分
              }

              const isSwitchableSystem = aux.multiGpuStyle === 'nvidia_optimus' ||
                aux.multiGpuStyle === 'amd_switchable';

              if (isSwitchableSystem && vendorIdHex !== '0x8086') {
                score += 30; // 在可切换系统中，非Intel设备很可能是独显
              }

              if (device.deviceString) {
                const lowerName = device.deviceString.toLowerCase();
                const discreteKeywords = ['rtx', 'gtx', 'radeon rx', 'radeon pro', 'geforce rtx'];
                const integratedKeywords = ['intel', 'hd graphics', 'uhd graphics', 'iris xe', 'radeon graphics'];

                if (discreteKeywords.some(keyword => lowerName.includes(keyword))) {
                  score += 20;
                }
                if (integratedKeywords.some(keyword => lowerName.includes(keyword))) {
                  score -= 10;
                }
              }

              device._discreteScore = score; // 将分数暂存到设备对象上
            });

            devices.sort((a, b) => b._discreteScore - a._discreteScore);

            return devices;
          }

          const gpus =
            sortGPUsByDiscreteLikelihood()
          if (gpus.length > 0) {
            // Use DRI_PRIME=vendor_id:device_id format to specify the dedicated GPU
            const gpu = gpus[0]
            env.DRI_PRIME = `${gpu.vendorId.toString(16)}:${gpu.deviceId.toString(16)}`
            if (gpus.some((g) => g.vendorId === 4318)) {
              // NVIDIA-specific environment variables
              env.__NV_PRIME_RENDER_OFFLOAD = '1'
              env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia'
            }
            ops.extraExecOption = { ...ops.extraExecOption, env }
          }
        }
      },
    })
  })
}

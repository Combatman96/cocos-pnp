import { AD_SDK_SCRIPT, getOrientationMeta } from './inject-vars'
import { exportSingleFile } from "@/exporter/2x"
import { getChannelRCSdkScript } from '@/utils'
import { TChannel, TChannelPkgOptions } from "@/typings"

export const export2xGoogle = async (options: TChannelPkgOptions) => {
  const { orientation } = options
  const channel: TChannel = 'Google'

  await exportSingleFile({
    ...options,
    channel,
    zipOutput: true,
    transformHTML: async ($) => {
      // 增加横竖屏meta
      const orientationStr = getOrientationMeta(orientation)
      $(orientationStr).appendTo('head')

      // 加入广告sdk脚本
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT
      $(sdkInjectScript).appendTo('head')
    },
    // transform: async (destPath) => {
    //   await zipToPath(destPath)
    //   unlinkSync(destPath)
    // }
  })
}
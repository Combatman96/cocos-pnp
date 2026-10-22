import { getChannelRCJson, getChannelRCSdkScript } from "@/utils"
import { exportSingleFile } from "@/exporter/2x"
import { TChannel, TChannelPkgOptions } from "@/typings"
import { INSERT_BEFORE_SCRIPT } from "./inject-vars"
import { buildStoreComments, extractStoreUrls } from "./store-urls"

export const export2xUnity = async (options: TChannelPkgOptions) => {
  const { resMapper = {} } = options
  const channel: TChannel = 'Unity'
  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || INSERT_BEFORE_SCRIPT
      $('body script').first().before(sdkInjectScript)

      // Store urls as html comments for Unity's checker (skipped when .adapterrc configures Unity).
      if (!getChannelRCJson(channel)) {
        const urls = extractStoreUrls(Object.values(resMapper))
        if (urls.length) {
          $('head').append(`\n${buildStoreComments(urls)}\n`)
        } else {
          console.warn('【Unity】no Play Store / App Store url found in the game code')
        }
      }
    }
  })
}

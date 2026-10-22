import { CheerioAPI } from "cheerio"
import { getAdapterRCJson, getChannelRCJson } from "@/utils"
import { TChannel } from "@/typings"
import { buildRuntimeScript } from "@/channels/runtime-scripts"

// Default channel runtime (`window.super_html`); skipped when `.adapterrc`
// configures the channel.
export const injectRuntimeScript = async ($: CheerioAPI, channel: TChannel) => {
  const script = buildRuntimeScript(channel, !!getChannelRCJson(channel))
  if (script) {
    $(script).appendTo('head')
  }
}

export const injectFromRCJson = async ($: CheerioAPI, channel: TChannel) => {
  const adapterJson = getAdapterRCJson()
  if (!adapterJson || !adapterJson.injectOptions || !adapterJson.injectOptions[channel]) {
    return
  }

  const { head, body } = adapterJson.injectOptions[channel]
  if (head) {
    $(head).appendTo('head')
  }

  if (body) {
    $('body script').first().before(body)
  }
}
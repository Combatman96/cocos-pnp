import type { Cheerio, CheerioAPI, Element } from "cheerio"

export type TWebOrientations = 'portrait' | 'landscape' | 'auto'

export type TPlatform =
  | 'web-desktop'
  | 'web-mobile'
  | 'wechatgame'
  | 'oppo-mini-game'
  | 'vivo-mini-game'
  | 'huawei-quick-game'
  | 'alipay-mini-game'
  | 'mac'
  | 'ios'
  | 'linux'
  // | 'ios-app-clip'
  | 'android'
  | 'ohos'
  | 'open-harmonyos'
  | 'windows'
  | 'xiaomi-quick-game'
  | 'baidu-mini-game'
  | 'bytedance-mini-game'
  | 'cocos-play'
  | 'huawei-agc'
  | 'link-sure'
  | 'qtt'
  | 'cocos-runtime'
  | 'xr-meta'
  | 'xr-huaweivr'
  | 'xr-pico'
  | 'xr-rokid'
  | 'xr-monado'
  | 'ar-android'
  | 'ar-ios';

export type TPlayableConfig = {
  /** 0 -> 横竖 1 -> 竖屏 2 -> 横屏 */
  playable_orientation: 0 | 1 | 2,
  playable_languages: string[]
}

export type TResourceData = { [key: string]: string }

export type TChannelPkgOptions = {
  orientation: TWebOrientations
  resMapper?: TResourceData
  compDiff?: number
}

export type TBuilderOptions = {
  channel: TChannel
  transformHTML?: ($: CheerioAPI) => Promise<void>
  transform?: (destPath: string) => Promise<void>
  // Single-file output only: ship as a zip holding the html as index.html.
  zipOutput?: boolean
  // Folder output only: zip as `<name>/<name>.html` inside `<name>.zip` (Mintegral).
  nestedZip?: boolean
} & Pick<TChannelPkgOptions, 'resMapper' | 'compDiff'>

export type TZipFromSingleFileOptions = TBuilderOptions & {
  transformScript?: (scriptNode: Cheerio<Element>) => Promise<void>
}

export type TChannel =
  | 'AppLovin'
  | 'Facebook'
  | 'Google'
  | 'IronSource'
  | 'Liftoff'
  | 'Mintegral'
  | 'Moloco'
  | 'Pangle'
  | 'Rubeex'
  | 'Tiktok'
  | 'Unity'

export type TChannelRC = {
  head: string
  body: string
  sdkScript: string
}

export type TAdapterRC = {
  buildPlatform?: TPlatform
  /** actual Cocos output folder name under build/, e.g. 'web-mobile-001'. Falls back to buildPlatform */
  buildFolderName?: string
  orientation?: TWebOrientations
  skipBuild?: boolean
  exportChannels?: TChannel[]
  enableSplash?: boolean
  injectOptions?: {
    [key in TChannel]: TChannelRC
  }
  tinify?: boolean
  tinifyApiKey?: string
  isZip?: boolean
  /**
   * Obfuscate project script bundles (assets/*.js, excluding assets/internal/)
   * before they are packed into the single HTML. Enabled by default on this
   * build. Set `false` to opt out, or pass options to tune.
   */
  obfuscate?: boolean | TObfuscateRC
}

export type TObfuscateRC = {
  /** Default true. */
  enable?: boolean
  /**
   * Control-flow flattening: rewrites logic into a switch-dispatch state
   * machine so execution flow cannot be read. Costs size and CPU. The branch
   * default differs (`feat/obfuscate` = off, `feat/obfuscate-flow` = on).
   */
  controlFlowFlattening?: boolean
  /** 0..1, how much code to flatten. Default 0.75 when flattening is on. */
  controlFlowFlatteningThreshold?: number
  /** Extra resource-key substrings to obfuscate beyond the default scope. */
  include?: string[]
  /** Resource-key substrings to never obfuscate. */
  exclude?: string[]
}
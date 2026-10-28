type TWebOrientations = 'portrait' | 'landscape' | 'auto'

type TPlatform =
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

type TChannel =
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

type TChannelRC = {
  head: string
  body: string
  sdkScript: string
}

type TAdapterRC = {
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

type TObfuscateRC = {
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

declare type TMode = 'parallel' | 'serial';

declare type TOptions = {
    buildFolderPath: string;
    adapterBuildConfig?: TAdapterRC | null;
    buildName?: string;
};
declare const exec2xAdapter: (options: TOptions, config?: {
    mode: TMode;
}) => Promise<void>;
declare const exec3xAdapter: (options: TOptions, config?: {
    mode: TMode;
}) => Promise<void>;

export { TAdapterRC, TChannel, TPlatform, TWebOrientations, exec2xAdapter, exec3xAdapter };

const ORIENTATION_META = `<meta name="ad.orientation" content="portrait,landscape">`
const LANDSCAPE_SIZE_META = `<meta name="ad.size" content="width=480,height=320">`
const PORTRAIT_SIZE_META = `<meta name="ad.size" content="width=320,height=480">`

// ad.orientation always allows both; only ad.size follows the build orientation.
export const getOrientationMeta = (orientation?: string) =>
  ORIENTATION_META + (orientation === 'landscape' ? LANDSCAPE_SIZE_META : PORTRAIT_SIZE_META)

export const AD_SDK_SCRIPT = `<script type="text/javascript" src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>`

export const SDK_EXIT_A_TAG = `<a onclick="ExitApi.exit()" style="display: none;"></a>`

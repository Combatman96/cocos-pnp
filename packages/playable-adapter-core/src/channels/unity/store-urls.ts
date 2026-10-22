// Unity's ad checker scans the HTML for store urls. Same patterns as the
// super-html extension; the urls live in the game scripts, which the exporter
// may compress, so they are read from the resource map instead of the HTML.
const STORE_URL_PATTERNS = [
  /https:\/\/play\.google\.com\/store\/apps[a-zA-Z0-9.\/?=\-_&%]*/,
  /https:\/\/apps\.apple\.com[a-zA-Z0-9.\/=\-_]*/,
]

export const extractStoreUrls = (resources: string[]): string[] => {
  const urls = new Set<string>()
  for (const pattern of STORE_URL_PATTERNS) {
    for (const text of resources) {
      if (text.startsWith('data:')) continue
      const url = pattern.exec(text)?.[0]
      if (url) {
        urls.add(url)
        break
      }
    }
  }
  return [...urls]
}

export const buildStoreComments = (urls: string[]): string =>
  urls.map((url) => `<!-- ${url.replace(/--/g, '%2D%2D')} -->`).join('\n')

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Serves exactly the given HTML files (nothing else) so a phone can load
// them over `adb reverse`. File i is at /b<i>/<basename>.
export function serveFiles(files, port) {
  const routes = new Map(files.map((f, i) => [`/b${i}/${encodeURIComponent(path.basename(f))}`, f]));
  const server = http.createServer((req, res) => {
    const file = routes.get(req.url.split('?')[0]);
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      resolve({
        urls: [...routes.keys()].map((r) => `http://localhost:${actual}${r}`),
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

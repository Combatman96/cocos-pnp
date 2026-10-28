import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// adb from ADB env, the winget package or Android SDK folder, else PATH.
// (A winget install only updates PATH for shells opened afterwards.)
function adbPath() {
  if (process.env.ADB) return process.env.ADB;
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [path.join(local, 'Android', 'Sdk', 'platform-tools', 'adb.exe')];
  const packages = path.join(local, 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(packages)) {
    for (const dir of fs.readdirSync(packages)) {
      if (dir.startsWith('Google.PlatformTools')) candidates.push(path.join(packages, dir, 'platform-tools', 'adb.exe'));
    }
  }
  return candidates.find((c) => fs.existsSync(c)) || 'adb';
}

function adb(...args) {
  try {
    return execFileSync(adbPath(), args, { encoding: 'utf8' });
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('adb not found: install it with `winget install Google.PlatformTools`');
    throw new Error(`adb ${args.join(' ')} failed: ${(e.stderr || e.message).trim()}`);
  }
}

// Parses `adb devices` output; returns the serial of the one ready device.
export function pickDevice(devicesOutput) {
  const rows = devicesOutput
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .filter((r) => r.length >= 2);
  if (rows.length === 0) {
    throw new Error(
      'no Android device found. On the phone: enable Developer options and USB debugging, then connect it by USB.'
    );
  }
  if (rows.length > 1) throw new Error(`${rows.length} devices connected; connect only the phone to test`);
  const [serial, state] = rows[0];
  if (state === 'unauthorized') throw new Error('phone not authorized: unlock it and tap "Allow" on the USB debugging prompt');
  if (state !== 'device') throw new Error(`phone is in state "${state}"; reconnect the USB cable`);
  return serial;
}

// Forwards the phone's Chrome DevTools to devtoolsPort and the PC's
// servePort to the phone. Returns the DevTools URL for puppeteer.connect.
export async function setupAndroid({ servePort, devtoolsPort = 9222 }) {
  const serial = pickDevice(adb('devices'));
  adb('-s', serial, 'forward', `tcp:${devtoolsPort}`, 'localabstract:chrome_devtools_remote');
  adb('-s', serial, 'reverse', `tcp:${servePort}`, `tcp:${servePort}`);
  const browserURL = `http://127.0.0.1:${devtoolsPort}`;
  try {
    const res = await fetch(`${browserURL}/json/version`);
    const info = await res.json();
    return { serial, browserURL, browser: info.Browser };
  } catch {
    throw new Error('cannot reach Chrome on the phone: open Chrome on the phone, keep it unlocked, and retry');
  }
}

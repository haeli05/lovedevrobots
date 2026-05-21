// Adapted from Google DeepMind's Aloha demo RobotLoader
// Fetches robot XMLs and meshes from mujoco_menagerie into the MuJoCo WASM VFS.

import { MENAGERIE_BASE } from './menagerie';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MujocoModule = any;

export async function loadMenagerieRobot(
  mujoco: MujocoModule,
  robotId: string,
  sceneFile = 'scene.xml',
  onProgress?: (msg: string) => void,
): Promise<void> {
  // Clean up VFS from previous load
  try { mujoco.FS.unmount('/working'); } catch { /* ignore */ }
  try { mujoco.FS.mkdir('/working'); } catch { /* ignore */ }

  const baseUrl = `${MENAGERIE_BASE}/${robotId}/`;
  const downloaded = new Set<string>();
  const queue: string[] = [sceneFile];
  const parser = new DOMParser();

  while (queue.length > 0) {
    const fname = queue.shift()!;
    if (downloaded.has(fname)) continue;
    downloaded.add(fname);

    onProgress?.(`Downloading ${fname}…`);

    const res = await fetch(baseUrl + fname);
    if (!res.ok) {
      console.warn(`menagerie: failed to fetch ${fname} (${res.status})`);
      continue;
    }

    // Ensure parent dirs exist in VFS
    const parts = fname.split('/');
    parts.pop();
    let cur = '/working';
    for (const part of parts) {
      cur += '/' + part;
      try { mujoco.FS.mkdir(cur); } catch { /* exists */ }
    }

    if (fname.endsWith('.xml')) {
      const text = await res.text();
      mujoco.FS.writeFile(`/working/${fname}`, text);
      scanDependencies(text, fname, parser, downloaded, queue);
    } else {
      const buf = new Uint8Array(await res.arrayBuffer());
      mujoco.FS.writeFile(`/working/${fname}`, buf);
    }
  }
}

function scanDependencies(
  xml: string,
  currentFile: string,
  parser: DOMParser,
  downloaded: Set<string>,
  queue: string[],
): void {
  const doc = parser.parseFromString(xml, 'text/xml');
  const dir = currentFile.includes('/') ? currentFile.split('/').slice(0, -1).join('/') + '/' : '';

  // Tags that reference external files
  const fileAttrs: [string, string][] = [
    ['include',  'file'],
    ['mesh',     'file'],
    ['texture',  'file'],
    ['hfield',   'file'],
    ['skin',     'file'],
  ];

  for (const [tag, attr] of fileAttrs) {
    for (const el of Array.from(doc.getElementsByTagName(tag))) {
      const val = el.getAttribute(attr);
      if (!val) continue;
      // Resolve relative path
      const resolved = val.startsWith('/') ? val.slice(1) : dir + val;
      if (!downloaded.has(resolved)) queue.push(resolved);
    }
  }
}

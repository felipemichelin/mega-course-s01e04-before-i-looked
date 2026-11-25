import { link, lstat, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { basename, dirname, isAbsolute, join, sep } from 'node:path';

class ExportError extends Error {}

function digestUrl(source) {
  if (!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/digest\/\d{4}-\d{2}-\d{2}$/.test(source)) {
    throw new ExportError('Use a 127.0.0.1 or localhost HTTP URL for /digest/YYYY-MM-DD.');
  }
  try {
    return new URL(source);
  } catch {
    throw new ExportError('Invalid digest URL.');
  }
}

async function outputPath(destination) {
  if (!isAbsolute(destination) || destination.endsWith(sep)) {
    throw new ExportError('Use an absolute destination file path.');
  }
  const directory = await realpath(dirname(destination));
  for (let ancestor = directory; ; ancestor = dirname(ancestor)) {
    const git = await lstat(join(ancestor, '.git')).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (git) throw new ExportError('Choose a destination outside any Git checkout.');
    if (ancestor === dirname(ancestor)) break;
  }
  return join(directory, basename(destination));
}

async function readDigest(url) {
  const response = await new Promise((resolve, reject) => {
    get(url, {
      agent: false,
      headers: { 'accept-encoding': 'identity' },
      signal: AbortSignal.timeout(10_000),
    }, resolve).on('error', reject);
  });
  try {
    if (response.statusCode !== 200) throw new ExportError(`Expected HTTP 200, received ${response.statusCode}.`);
    if (!/^text\/html\s*(?:;|$)/i.test(response.headers['content-type'] ?? '')) {
      throw new ExportError('Expected an HTML response.');
    }
    if (response.headers['content-encoding'] && response.headers['content-encoding'].toLowerCase() !== 'identity') {
      throw new ExportError('Expected an uncompressed HTML response.');
    }
    const chunks = [];
    for await (const chunk of response) chunks.push(chunk);
    return Buffer.concat(chunks);
  } finally {
    response.destroy();
  }
}

function checkRigHtml(bytes) {
  // Check the output of rig's server-rendered layout. Write the original buffer after validation.
  const html = bytes.toString('utf8').replace(/<!--[\s\S]*?-->/g, '');
  const styleElement = /(<style(?=[\s>])[^>]*>)([\s\S]*?)<\/style\s*>/gi;
  const [stylesheet, extraStylesheet] = html.matchAll(styleElement);
  const css = stylesheet?.[2].replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!css || extraStylesheet || /@import\b|\b(?:url|image-set)\s*\(|\\/i.test(css)) {
    throw new ExportError('Expected one self-contained inline stylesheet.');
  }
  const markup = html.replace(styleElement, '$1</style>');
  const startTag = /<([a-z][\w:-]*)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  for (const [, tag, attributes] of markup.matchAll(startTag)) {
    const attributeNames = attributes.replace(/"[^"]*"|'[^']*'/g, '""');
    if (/^(?:base|embed|frame|iframe|link|object|script)$/i.test(tag) ||
        /[\s/](?:on[\w:-]+|src|srcset|style|(?:xlink:)?href|background|poster|http-equiv)\s*=/i.test(attributeNames)) {
      throw new ExportError('Expected static HTML without scripts or external assets.');
    }
  }
}

async function writePreview(output, bytes) {
  const staging = await mkdtemp(join(dirname(output), '.rig-preview-'));
  try {
    const draft = join(staging, 'preview.html');
    await writeFile(draft, bytes, { mode: 0o600 });
    await link(draft, output);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

try {
  const [, , source, destination, ...extra] = process.argv;
  if (!source || !destination || extra.length) {
    throw new ExportError('Usage: node scripts/export-preview.mjs LOCAL_DIGEST_URL /absolute/path/preview.html');
  }
  const url = digestUrl(source);
  const output = await outputPath(destination);
  const bytes = await readDigest(url);
  checkRigHtml(bytes);
  await writePreview(output, bytes);
  console.log(`Exported ${bytes.length} bytes.`);
} catch (error) {
  const message = error instanceof ExportError ? error.message : {
    EEXIST: 'Choose a destination file that does not exist yet.',
    ENOENT: 'The destination directory must already exist.',
    ECONNREFUSED: 'Could not connect to rig on the requested port.',
    ABORT_ERR: 'Timed out receiving the digest from rig.',
  }[error.code] ?? 'Could not export the preview.';
  console.error(message);
  process.exitCode = 1;
}

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';

const dist = new URL('../dist/', import.meta.url);
const readPage = (route) => readFile(new URL(`${route}index.html`, dist), 'utf8');
const home = await readPage('');
const routes = {
  '': 'home',
  'build/': 'build',
  'get-your-veetr/': 'get-your-veetr',
  'about/': 'about',
  'contact/': 'contact',
  'legal/privacy/': 'privacy',
  'legal/terms/': 'terms',
};
const docsRoutes = [
  'docs/',
  'docs/hardware/',
  'docs/components/',
  'docs/wiring/',
  'docs/hardware-reference/',
  'docs/firmware-update/',
  'docs/compliance/',
  'docs/development/',
  'docs/platformio/',
  'docs/firmware-testing/',
  'docs/storage/',
  'docs/version-management/',
];
const allRoutes = [...Object.keys(routes), ...docsRoutes];

test('all nineteen website and documentation routes are generated', async () => {
  for (const route of allRoutes) {
    assert.ok((await readPage(route)).includes('<html'), route);
  }
});

test('the GitHub Pages build preserves the custom domain and bypasses Jekyll', async () => {
  assert.equal((await readFile(new URL('CNAME', dist), 'utf8')).trim(), 'veetr.org');
  assert.ok((await readFile(new URL('.nojekyll', dist), 'utf8')).includes('without Jekyll'));
});

test('the homepage contains the complete product story and existing destinations', () => {
  for (const text of ['Sailing hardware', 'Progressive Web App', 'USB-C power', 'AWS', 'AWA', 'TWS', 'TWA', 'SOG', 'HDG', 'Heel', 'GPS', 'Best fit', 'Less ideal', 'certified equipment today', 'Follow the project']) {
    assert.ok(home.includes(text), text);
  }
  assert.match(home, /https:\/\/m\.veetr\.com\/form\/generate\.js\?id=1/);
  assert.match(home, /https:\/\/app\.veetr\.org\//);
  assert.match(home, /https:\/\/github\.com\/veetrlabs\/veetr/);
  assert.match(home, /id="cookie-banner"/);
  assert.match(home, /id="cookie-decline"/);
  assert.doesNotMatch(home, /href="\/product\/"/);
  assert.doesNotMatch(home, />Product<\/a>/);
});

test('dashboard is optimized without losing its landscape proportions', async () => {
  const image = home.match(/<img[^>]*alt="Veetr app shown on tablet and phone"[^>]*>/)?.[0];
  assert.ok(image);
  const src = image.match(/src="([^"]+)"/)[1];
  const width = Number(image.match(/width="(\d+)"/)[1]);
  const height = Number(image.match(/height="(\d+)"/)[1]);
  assert.ok(width > height);
  assert.match(src, /\.webp$/);
  assert.ok((await stat(new URL(src.replace(/^\//, ''), dist))).size > 0);
});

test('hardware is the primary homepage image', async () => {
  const homeHardware = home.match(/<img[^>]*alt="Veetr hardware unit with wind sensor, Bluetooth antenna, and GPS antenna"[^>]*>/)?.[0];
  assert.ok(homeHardware);
  assert.match(homeHardware, /src="[^"]+\.webp"/);
  const src = homeHardware.match(/src="([^"]+)"/)[1];
  assert.ok((await stat(new URL(src.replace(/^\//, ''), dist))).size > 0);
  assert.ok(home.includes('A portable sensor unit measures wind'));
});

test('every page shares Starlight, accessible navigation, and exactly one title and footer', async () => {
  for (const route of allRoutes) {
    const page = await readPage(route);
    assert.match(page, /<starlight-theme-select/, route);
    assert.match(page, /Skip to content/, route);
    assert.match(page, /<details[^>]*class="mobile-menu(?:\s[^"]*)?"/, route);
    if (!route.startsWith('docs/')) {
      assert.doesNotMatch(page, /<html[^>]*data-has-sidebar/, route);
    } else {
      assert.match(page, /<html[^>]*data-has-sidebar/, route);
    }
    assert.equal((page.match(/<h1\b/g) || []).length, 1, route);
    assert.equal((page.match(/<footer\b/g) || []).length, 1, route);
    assert.equal((page.match(/id="cookie-banner"/g) || []).length, 1, route);
    const styles = [...page.matchAll(/<link[^>]*href="([^"]+\.css)"[^>]*>/g)];
    let sharedTheme = false;
    for (const [, href] of styles) {
      const css = await readFile(new URL(href.replace(/^\//, ''), dist), 'utf8');
      sharedTheme ||= css.includes('--veetr-surface');
      assert.ok(!css.includes('.page-hero-compact'), `${route} still loads legacy styles`);
    }
    assert.ok(sharedTheme, `${route} is missing the shared theme`);
  }
});

const normalize = (value) => value
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/&(?:amp|quot|apos|lt|gt|#39|#x27|#34);/g, (entity) => ({
    '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&#39;': "'", '&#x27;': "'", '&#34;': '"',
  })[entity])
  .replace(/\s+/g, ' ').replace(/\s+([.,:;!?])/g, '$1').trim();

test('all Markdown copy, effective dates, descriptions, and canonical URLs survive', async () => {
  for (const [route, source] of Object.entries(routes)) {
    const markdown = await readFile(new URL(`../src/content/pages/${source}.md`, import.meta.url), 'utf8');
    const [, metadata, body] = markdown.split('---');
    const page = await readPage(route);
    const text = normalize(page.replace(/<[^>]+>/g, ' '));
    for (const paragraph of body.trim().split(/\n\s*\n/)) {
      const plain = normalize(paragraph.replace(/^\s*(?:#{1,6}|\d+\.)\s+/gm, '').replace(/[*_]/g, ''));
      assert.ok(text.includes(plain), `${route} missing copy: ${plain}`);
    }
    for (const field of ['description', 'effectiveDate']) {
      const value = metadata.match(new RegExp(`^${field}: "(.*)"$`, 'm'))?.[1];
      if (value) assert.ok(page.includes(value), `${route} missing ${field}`);
    }
    const title = route === '' ? 'Veetr' : `${metadata.match(/^title: "(.*)"$/m)[1]} | Veetr`;
    assert.ok(page.includes(`<title>${title}</title>`), `${route} title`);
    const canonical = page.match(/rel="canonical" href="([^"]+)"/)?.[1];
    assert.equal(canonical?.replace(/\/$/, ''), `https://veetr.org/${route}`.replace(/\/$/, ''), route);
  }
});

test('newsletter, contact, and campaign forms retain their original destinations', async () => {
  for (const [route, id] of Object.entries({ '': 1, 'build/': 1, 'about/': 1, 'contact/': 2, 'get-your-veetr/': 4 })) {
    const page = await readPage(route);
    assert.ok(page.includes(`https://m.veetr.com/form/generate.js?id=${id}`), route);
    assert.equal((page.match(/form\/generate\.js/g) || []).length, 1, route);
  }
  assert.ok((await readPage('contact/')).includes('mailto:veetr@linhart.email'));
});

test('all local links and image assets resolve in the generated site', async () => {
  for (const route of allRoutes) {
    const page = await readPage(route);
    const references = [...page.matchAll(/(?:href|src)="(\/[^"#?]*)[^"]*"/g)];
    for (const [, path] of references) {
      if (path.startsWith('//')) continue;
      const file = path.endsWith('/') ? `${path}index.html` : path;
      assert.ok((await stat(new URL(file.slice(1), dist))).isFile(), `${route}: ${path}`);
    }
    for (const image of page.matchAll(/<img\b[^>]*>/g)) {
      // Astro may serialize the decorative alt="" attribute as bare `alt`.
      assert.match(image[0], /\balt(?:="[^"]*"|(?=\s|>))/, route);
      if (/\bsrc="\//.test(image[0])) {
        assert.match(image[0], /\bwidth="\d+"/, route);
        assert.match(image[0], /\bheight="\d+"/, route);
      }
    }
  }
});

test('hardware resources and campaign details remain available', async () => {
  const build = await readPage('build/');
  for (const part of ['Microcontroller', '9-axis sensor', 'Wind sensor', 'GPS module', 'RS485 interface', 'Custom PCB', 'Enclosure', 'Cables and hardware', 'Builder responsibility']) {
    assert.ok(build.includes(part), part);
  }
  const docs = await readPage('docs/');
  for (const route of docsRoutes) {
    if (route !== 'docs/') assert.ok(docs.includes(`/${route}`), route);
  }
  const hardware = await readPage('docs/components/');
  for (const image of ['ESP32 DevKitC WROOM-32U development board', 'BNO080 nine-axis IMU module', 'Ultrasonic wind sensor', 'GPS module', 'GPS antenna', 'RS485 module']) {
    assert.ok(hardware.includes(`alt="${image}"`), image);
  }
  assert.doesNotMatch(hardware, /alicdn\.com|aliexpress-media\.com/);
  const wiring = await readPage('docs/wiring/');
  for (const connection of ['Enclosure connections', 'Veetr pin map', 'GPIO21', 'GPIO22', 'GPIO16', 'GPIO17', 'GPIO32', 'GPIO33', 'GPIO14', 'Lid controls', 'First power-on checklist']) {
    assert.ok(wiring.includes(connection), connection);
  }
  assert.doesNotMatch(wiring, /ESP32 DevKitC WROOM-32U Pinout:/);
  const campaign = await readPage('get-your-veetr/');
  for (const detail of ['Audience proof', 'Quote the work', 'Open fund campaign', 'Certify, then batch', 'EUR 15,000', 'EUR 9,000']) {
    assert.ok(campaign.includes(detail), detail);
  }
});

test('documentation has navigation, search data, source links, and clean cross-links', async () => {
  for (const route of docsRoutes) {
    const page = await readPage(route);
    assert.match(page, /data-pagefind-body/, route);
    assert.match(page, /On this page/, route);
    assert.match(page, /https:\/\/github\.com\/veetrlabs\/veetr\/edit\/main\/docs\//, route);
    assert.doesNotMatch(page, /href="(?:\.\/|\.\.\/)[^"]+"/, route);
    assert.match(page, /aria-current="page"[^>]*>Docs</, route);
  }
  assert.ok((await stat(new URL('pagefind/pagefind.js', dist))).isFile());
});

test('the former setup URL redirects to the documentation root', async () => {
  const redirect = await readPage('docs/setup/');
  assert.match(redirect, /http-equiv="refresh"/);
  assert.match(redirect, /url=\/docs\//);
});

test('the former product URL redirects to the merged homepage', async () => {
  const redirect = await readPage('product/');
  assert.match(redirect, /http-equiv="refresh"/);
  assert.match(redirect, /url=\//);
});

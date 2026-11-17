const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

function trackingHarness(gtag) {
  const listeners = new Map();
  const filename = join(__dirname, '..', 'pdf-analytics.js');
  runInNewContext(readFileSync(filename, 'utf8'), {
    document: { addEventListener: (type, listener) => listeners.set(type, listener) },
    window: { gtag }
  }, filename);

  return (href, id, type = 'click', button = 0) => {
    const anchor = Object.assign(new URL(href), { id });
    listeners.get(type)({ type, button, target: { closest: () => anchor } });
  };
}

test('records the exact Buy link and omits Google linker parameters', () => {
  const calls = [];
  const activate = trackingHarness((...args) => calls.push(args));
  activate('https://payhip.com/b/kXKR7?_gl=example#top', 'pdf-guide-hero-buy');
  assert.deepEqual(calls.map(([command, name, params]) => [command, name, { ...params }]), [
    ['event', 'pdf_buy_click', {
      pdf_button_id: 'pdf-guide-hero-buy', link_url: 'https://payhip.com/b/kXKR7'
    }]
  ]);
});

test('records a middle-click on a Sample link and ignores unrelated links', () => {
  const calls = [];
  const activate = trackingHarness((...args) => calls.push(args));
  activate('https://payhip.com/preview/kXKR7', 'pdf-guide-contents-preview', 'auxclick', 1);
  activate('https://payhip.com/preview/kXKR7', 'pdf-guide-contents-preview', 'auxclick', 2);
  activate('https://payhip.com/b/another-product', 'pdf-other-buy');
  activate('https://example.com/b/kXKR7', 'pdf-guide-hero-buy');
  activate('https://payhip.com/b/kXKR7', '');
  assert.deepEqual(calls.map(([, name, params]) => [name, { ...params }]), [
    ['pdf_sample_click', {
      pdf_button_id: 'pdf-guide-contents-preview', link_url: 'https://payhip.com/preview/kXKR7'
    }]
  ]);
});

test('allows clicks when Google Analytics is unavailable', () => {
  const activate = trackingHarness();
  assert.doesNotThrow(() => activate('https://payhip.com/b/kXKR7', 'pdf-blog-buy'));
});

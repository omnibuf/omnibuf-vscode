import assert from 'node:assert/strict';
import test from 'node:test';
import { formatHexDump } from '../src/hex';
import { escapeHtml, highlightJson, renderWebviewHtml } from '../src/webview';

test('escapeHtml neutralizes HTML special characters', () => {
  assert.equal(escapeHtml('<script>"a&b\'</script>'), '&lt;script&gt;&quot;a&amp;b&#39;&lt;/script&gt;');
});

test('highlightJson wraps keys, strings, numbers, booleans, and null', () => {
  const html = highlightJson('{"name": "fra-01", "asn": 64512, "active": true, "meta": null}');
  assert.match(html, /<span class="tok-key">&quot;name&quot;<\/span>:/);
  assert.match(html, /<span class="tok-string">&quot;fra-01&quot;<\/span>/);
  assert.match(html, /<span class="tok-num">64512<\/span>/);
  assert.match(html, /<span class="tok-bool">true<\/span>/);
  assert.match(html, /<span class="tok-null">null<\/span>/);
});

test('renderWebviewHtml renders default JSON view with hex pane and CSP nonce', () => {
  const html = renderWebviewHtml({
    fileName: 'peer.obuf',
    viewMode: 'json',
    decode: { ok: true, json: '{\n  "asn": 64512\n}' },
    hex: formatHexDump(new Uint8Array([0x19, 0x30, 0x5d, 0x2c])),
    nonce: 'deadbeef',
  });
  assert.match(html, /nonce-deadbeef/);
  assert.match(html, /data-mode="json"/);
  assert.match(html, /19 30 5d 2c/);
  assert.match(html, /Copy JSON/);
});

test('renderWebviewHtml renders error state cleanly while preserving hex pane', () => {
  const html = renderWebviewHtml({
    fileName: 'corrupt.obuf',
    viewMode: 'json',
    decode: { ok: false, code: 'DECODE_FAILED', message: 'invalid container length' },
    hex: formatHexDump(new Uint8Array([0xff, 0xff])),
    nonce: 'cafebabe',
  });
  assert.match(html, /Decode failed/);
  assert.match(html, /invalid container length/);
  assert.match(html, /id="btn-copy" disabled/);
  assert.match(html, /ff ff/);
});

test('renderWebviewHtml escapes </script> and line separators in inline script fileName', () => {
  const maliciousName = 'evil</script><img src=x onerror=alert(1)>\u2028\u2029.obuf';
  const html = renderWebviewHtml({
    fileName: maliciousName,
    viewMode: 'json',
    decode: { ok: true, json: '{}' },
    hex: formatHexDump(new Uint8Array([0x00])),
    nonce: '12345678',
  });

  const scriptMatches = html.match(/<\/script>/gi) ?? [];
  assert.equal(scriptMatches.length, 1, 'HTML must contain only the single closing </script> tag');

  const inlineDecl = html.match(/const fileName = (".*?");/);
  const serialized = inlineDecl?.[1];
  assert.ok(serialized, 'inline fileName declaration should be present');
  assert.doesNotMatch(serialized, /<|>|\/|\u2028|\u2029/);
  assert.equal(JSON.parse(serialized), maliciousName);
});

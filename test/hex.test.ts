import assert from 'node:assert/strict';
import test from 'node:test';
import { formatHexDump } from '../src/hex';

test('formatHexDump handles empty buffer', () => {
  const res = formatHexDump(new Uint8Array(0));
  assert.equal(res.totalBytes, 0);
  assert.equal(res.renderedBytes, 0);
  assert.equal(res.truncated, false);
  assert.match(res.text, /empty file/i);
});

test('formatHexDump formats canonical 16-byte rows with ASCII preview', () => {
  const bytes = new Uint8Array([
    0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x4f, 0x6d,
    0x6e, 0x69, 0x42, 0x75, 0x66, 0x00, 0xff, 0x21,
    0x41,
  ]);
  const res = formatHexDump(bytes);
  assert.equal(res.totalBytes, 17);
  assert.equal(res.renderedBytes, 17);
  assert.equal(res.truncated, false);
  const lines = res.text.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(
    lines[0],
    '00000000  48 65 6c 6c 6f 20 4f 6d  6e 69 42 75 66 00 ff 21  |Hello OmniBuf..!|',
  );
  assert.equal(
    lines[1],
    '00000010  41                                                |A|',
  );
});

test('formatHexDump truncates when exceeding maxBytes', () => {
  const bytes = new Uint8Array(64).fill(0x41);
  const res = formatHexDump(bytes, 32);
  assert.equal(res.totalBytes, 64);
  assert.equal(res.renderedBytes, 32);
  assert.equal(res.truncated, true);
  assert.match(res.text, /truncated at 32 of 64 bytes/);
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { buildDecodeArgs, buildEncodeArgs, decodeFile, encodeJson } from '../src/cli';

test('buildDecodeArgs builds minimal and schema-aware arguments', () => {
  assert.deepEqual(buildDecodeArgs('/tmp/peer.obuf', {}), ['decode', '-i', '/tmp/peer.obuf']);
  assert.deepEqual(
    buildDecodeArgs('/tmp/-weird name.obuf', {
      schemaPath: '/tmp/schema.pb.gz',
      messageType: 'demo.PeerUpdate',
    }),
    ['decode', '-s', '/tmp/schema.pb.gz', '-t', 'demo.PeerUpdate', '-i', '/tmp/-weird name.obuf'],
  );
});

test('buildEncodeArgs handles field0, deterministic, and schema flags', () => {
  assert.deepEqual(buildEncodeArgs({}), ['encode']);
  assert.deepEqual(buildEncodeArgs({ includeField0: false, deterministic: true }), [
    'encode',
    '--no-field0',
    '--deterministic',
  ]);
  assert.deepEqual(
    buildEncodeArgs({
      schemaPath: '/tmp/schema.pb.gz',
      messageType: 'demo.PeerUpdate',
      includeField0: false,
    }),
    ['encode', '-s', '/tmp/schema.pb.gz', '-t', 'demo.PeerUpdate'],
  );
});

test('decodeFile decodes a real .obuf file via omnibuf CLI', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'omnibuf-vscode-'));
  try {
    const filePath = path.join(dir, 'peer.obuf');
    const encoded = execFileSync('omnibuf', [], {
      input: JSON.stringify({ asn: 64512, router_id: 'edge-fra-01', active: true }),
    });
    writeFileSync(filePath, encoded);

    const res = await decodeFile(filePath, { cliPath: 'omnibuf' });
    assert.equal(res.ok, true);
    if (res.ok) {
      const parsed = JSON.parse(res.json);
      assert.deepEqual(parsed, { asn: 64512, router_id: 'edge-fra-01', active: true });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('encodeJson round-trips JSON to .obuf wire bytes and back', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'omnibuf-vscode-'));
  try {
    const input = { asn: 64512, router_id: 'edge-ber-02', active: true, location: { city: 'Berlin' } };
    const encoded = await encodeJson(JSON.stringify(input), { cliPath: 'omnibuf' });
    assert.equal(encoded.ok, true);
    if (encoded.ok) {
      assert.ok(encoded.bytes.length > 0);
      const filePath = path.join(dir, 'roundtrip.obuf');
      writeFileSync(filePath, encoded.bytes);
      const decoded = await decodeFile(filePath, { cliPath: 'omnibuf' });
      assert.equal(decoded.ok, true);
      if (decoded.ok) {
        assert.deepEqual(JSON.parse(decoded.json), input);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('encodeJson reports ENCODE_FAILED on invalid JSON', async () => {
  const res = await encodeJson('{invalid json', { cliPath: 'omnibuf' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'ENCODE_FAILED');
    assert.match(res.message, /parse JSON/i);
  }
});

test('encodeJson reports ENOENT when CLI is missing', async () => {
  const res = await encodeJson('{}', { cliPath: 'nonexistent-omnibuf-binary-xyz' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'ENOENT');
    assert.match(res.message, /omnibuf\.cliPath/);
  }
});

test('decodeFile reports ENOENT when CLI is missing', async () => {
  const res = await decodeFile('/tmp/does-not-matter.obuf', {
    cliPath: 'nonexistent-omnibuf-binary-xyz',
  });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'ENOENT');
    assert.match(res.message, /omnibuf\.cliPath/);
  }
});

test('decodeFile reports DECODE_FAILED on invalid wire bytes', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'omnibuf-vscode-'));
  try {
    const filePath = path.join(dir, 'corrupt.obuf');
    writeFileSync(filePath, Buffer.from([0xff, 0xff, 0xff]));

    const res = await decodeFile(filePath, { cliPath: 'omnibuf' });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, 'DECODE_FAILED');
      assert.ok(res.message.length > 0);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

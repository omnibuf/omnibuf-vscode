import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { buildDecodeArgs, buildEncodeArgs, decodeFile, encodeJson } from '../src/cli';

const OMNIBUF_CLI = process.env.OMNIBUF_CLI || 'omnibuf';

function findProtoc(): string | null {
  if (process.env.PROTOC) {
    return process.env.PROTOC;
  }
  for (const candidate of ['protoc', '/opt/homebrew/bin/protoc']) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      if (candidate.startsWith('/') && existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

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
    const encoded = execFileSync(OMNIBUF_CLI, [], {
      input: JSON.stringify({ asn: 64512, router_id: 'edge-fra-01', active: true }),
    });
    writeFileSync(filePath, encoded);

    const res = await decodeFile(filePath, { cliPath: OMNIBUF_CLI });
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
    const encoded = await encodeJson(JSON.stringify(input), { cliPath: OMNIBUF_CLI });
    assert.equal(encoded.ok, true);
    if (encoded.ok) {
      assert.ok(encoded.bytes.length > 0);
      const filePath = path.join(dir, 'roundtrip.obuf');
      writeFileSync(filePath, encoded.bytes);
      const decoded = await decodeFile(filePath, { cliPath: OMNIBUF_CLI });
      assert.equal(decoded.ok, true);
      if (decoded.ok) {
        assert.deepEqual(JSON.parse(decoded.json), input);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('encodeJson and decodeFile round-trip Protobuf Editions 2023, 2024, and 2026 schemas', async (t) => {
  const protoc = findProtoc();
  if (!protoc) {
    t.skip('protoc not found');
    return;
  }

  const editions = [
    { year: '2023', vis: '' },
    { year: '2024', vis: 'export ' },
    { year: '2026', vis: 'export ' },
  ];

  for (const ed of editions) {
    await t.test(`edition_${ed.year}`, async () => {
      const dir = mkdtempSync(path.join(tmpdir(), `omnibuf-vscode-ed${ed.year}-`));
      try {
        const protoPath = path.join(dir, 'schema.proto');
        const fdsPath = path.join(dir, 'schema.pb');
        const obufPath = path.join(dir, 'record.obuf');
        const pkg = `vscode.ed${ed.year}`;
        const protoSrc = `edition = "${ed.year}";
package ${pkg};

import "google/protobuf/descriptor.proto";

extend google.protobuf.FieldOptions {
  string editor_hint = 50031;
}

${ed.vis}enum State {
  STATE_UNSPECIFIED = 0;
  STATE_ACTIVE = 1;
}

${ed.vis}message Child {
  int32 id = 1;
  string note = 2 [(editor_hint) = "utf8"];
}

${ed.vis}message Record {
  int32 explicit_int = 1;
  bool explicit_bool = 2;
  string explicit_string = 3;
  bytes explicit_bytes = 4;
  State status = 5;
  Child delimited_child = 6 [features.message_encoding = DELIMITED];
  oneof choice {
    int32 choice_int = 7;
    bool choice_flag = 8;
  }
}
`;
        writeFileSync(protoPath, protoSrc, 'utf8');
        execFileSync(protoc, [`-I${dir}`, '--include_imports', `--descriptor_set_out=${fdsPath}`, protoPath]);

        const input = {
          explicit_int: 0,
          explicit_bool: false,
          explicit_string: '',
          explicit_bytes: '',
          status: -7,
          delimited_child: { id: 42, note: `ed-${ed.year}` },
          choice_flag: false,
        };

        const encoded = await encodeJson(JSON.stringify(input), {
          cliPath: OMNIBUF_CLI,
          schemaPath: fdsPath,
          messageType: `${pkg}.Record`,
          deterministic: true,
        });
        assert.equal(encoded.ok, true, encoded.ok ? '' : encoded.message);
        if (!encoded.ok) {
          return;
        }
        assert.ok(encoded.bytes.length > 0);
        writeFileSync(obufPath, encoded.bytes);

        const decoded = await decodeFile(obufPath, {
          cliPath: OMNIBUF_CLI,
          schemaPath: fdsPath,
          messageType: 'Record',
        });
        assert.equal(decoded.ok, true, decoded.ok ? '' : decoded.message);
        if (decoded.ok) {
          assert.deepEqual(JSON.parse(decoded.json), input);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  await t.test('edition_2026_auto_select_and_closed_enum_rejection', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'omnibuf-vscode-ed2026-err-'));
    try {
      const singleProto = path.join(dir, 'single.proto');
      const singleFds = path.join(dir, 'single.pb');
      const singleObuf = path.join(dir, 'single.obuf');
      writeFileSync(
        singleProto,
        `edition = "2026";
package vscode.single26;
import "google/protobuf/descriptor.proto";
extend google.protobuf.FieldOptions {
  string single_hint = 50032;
}
export message Single {
  int32 count = 1 [(single_hint) = "nonneg"];
  bool active = 2;
}
`,
        'utf8',
      );
      execFileSync(protoc, [`-I${dir}`, '--include_imports', `--descriptor_set_out=${singleFds}`, singleProto]);

      const encSingle = await encodeJson(JSON.stringify({ count: 0, active: false }), {
        cliPath: OMNIBUF_CLI,
        schemaPath: singleFds,
      });
      assert.equal(encSingle.ok, true, encSingle.ok ? '' : encSingle.message);
      if (encSingle.ok) {
        writeFileSync(singleObuf, encSingle.bytes);
        const decSingle = await decodeFile(singleObuf, {
          cliPath: OMNIBUF_CLI,
          schemaPath: singleFds,
        });
        assert.equal(decSingle.ok, true, decSingle.ok ? '' : decSingle.message);
        if (decSingle.ok) {
          assert.deepEqual(JSON.parse(decSingle.json), { count: 0, active: false });
        }
      }

      const closedProto = path.join(dir, 'closed.proto');
      const closedFds = path.join(dir, 'closed.pb');
      writeFileSync(
        closedProto,
        `edition = "2026";
package vscode.closed26;
export enum ClosedStatus {
  option features.enum_type = CLOSED;
  CLOSED_STATUS_UNSPECIFIED = 0;
}
export message BadRecord {
  ClosedStatus status = 1;
}
`,
        'utf8',
      );
      execFileSync(protoc, [`-I${dir}`, `--descriptor_set_out=${closedFds}`, closedProto]);

      const rejected = await encodeJson(JSON.stringify({ status: 'CLOSED_STATUS_UNSPECIFIED' }), {
        cliPath: OMNIBUF_CLI,
        schemaPath: closedFds,
        messageType: 'vscode.closed26.BadRecord',
      });
      assert.equal(rejected.ok, false);
      if (!rejected.ok) {
        assert.equal(rejected.code, 'ENCODE_FAILED');
        assert.match(rejected.message, /CLOSED enums/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

test('encodeJson reports ENCODE_FAILED on invalid JSON', async () => {
  const res = await encodeJson('{invalid json', { cliPath: OMNIBUF_CLI });
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

    const res = await decodeFile(filePath, { cliPath: OMNIBUF_CLI });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, 'DECODE_FAILED');
      assert.ok(res.message.length > 0);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('encodeJson enforces maxBufferBytes cap on stdout', async () => {
  const res = await encodeJson(
    JSON.stringify({ payload: 'x'.repeat(256) }),
    { cliPath: OMNIBUF_CLI, maxBufferBytes: 16 },
  );
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'ENCODE_FAILED');
    assert.match(res.message, /exceeded 16 bytes limit/);
  }
});

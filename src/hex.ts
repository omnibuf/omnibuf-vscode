export interface HexDumpResult {
  text: string;
  totalBytes: number;
  renderedBytes: number;
  truncated: boolean;
}

/**
 * Formats binary bytes as a canonical 16-byte-per-line hex + ASCII dump:
 * 00000000  19 30 5d 2c 00 0a 02 02  06 61 73 6e 04 12 72 6f  |.0],.....asn..ro|
 */
export function formatHexDump(bytes: Uint8Array, maxBytes = 262_144): HexDumpResult {
  const totalBytes = bytes.length;
  if (totalBytes === 0) {
    return {
      text: '(empty file: 0 bytes)',
      totalBytes: 0,
      renderedBytes: 0,
      truncated: false,
    };
  }

  const limit = Math.min(totalBytes, Math.max(16, maxBytes));
  const truncated = totalBytes > limit;
  const lines: string[] = [];

  for (let offset = 0; offset < limit; offset += 16) {
    const addr = offset.toString(16).padStart(8, '0');
    const hexParts: string[] = [];
    let ascii = '';

    for (let i = 0; i < 16; i++) {
      if (i === 8) {
        hexParts.push('');
      }
      const idx = offset + i;
      if (idx < limit) {
        const b = bytes[idx]!;
        hexParts.push(b.toString(16).padStart(2, '0'));
        ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
      } else {
        hexParts.push('  ');
      }
    }

    lines.push(`${addr}  ${hexParts.join(' ')}  |${ascii}|`);
  }

  if (truncated) {
    lines.push(
      `... truncated at ${limit.toLocaleString('en-US')} of ${totalBytes.toLocaleString('en-US')} bytes (adjust omnibuf.maxHexBytes to view more)`,
    );
  }

  return {
    text: lines.join('\n'),
    totalBytes,
    renderedBytes: limit,
    truncated,
  };
}

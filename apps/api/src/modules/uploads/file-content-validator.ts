import { BadRequestException } from '@nestjs/common';

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'text/plain',
  'text/csv',
  'text/markdown',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/markdown': '.md',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/msword': '.doc',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.ms-powerpoint': '.ppt',
};

const OOXML_MARKERS: Partial<Record<string, string>> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word/',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xl/',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt/',
};

const LEGACY_OFFICE_MIMES = new Set([
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]);

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function isZip(buffer: Buffer): boolean {
  return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])
    || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])
    || startsWith(buffer, [0x50, 0x4b, 0x07, 0x08]);
}

function isIsoMedia(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
}

function isText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function contentMatches(mimeType: string, buffer: Buffer): boolean {
  if (mimeType === 'image/jpeg') return startsWith(buffer, [0xff, 0xd8, 0xff]);
  if (mimeType === 'image/png') return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mimeType === 'image/avif') return isIsoMedia(buffer) && ['avif', 'avis'].includes(buffer.subarray(8, 12).toString('ascii'));
  if (mimeType.startsWith('text/')) return isText(buffer);
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'application/zip') return isZip(buffer);
  if (mimeType in OOXML_MARKERS) {
    if (!isZip(buffer)) return false;
    const archiveNames = buffer.toString('latin1').toLowerCase();
    return archiveNames.includes('[content_types].xml') && archiveNames.includes(OOXML_MARKERS[mimeType]!);
  }
  if (LEGACY_OFFICE_MIMES.has(mimeType)) return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (mimeType === 'audio/mpeg') return buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (mimeType === 'audio/ogg') {
    if (buffer.subarray(0, 4).toString('ascii') !== 'OggS') return false;
    const header = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
    return header.includes('vorbis') || header.includes('OpusHead') || header.includes('Speex');
  }
  if (mimeType === 'audio/wav') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE';
  if (mimeType === 'audio/mp4' || mimeType === 'video/mp4') return isIsoMedia(buffer);
  if (mimeType === 'video/quicktime') return isIsoMedia(buffer) && buffer.subarray(8, 12).toString('ascii').trim() === 'qt';
  if (mimeType === 'video/webm') return startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
  return false;
}

export function validateFileContent(mimeType: string, buffer: Buffer): { extension: string } {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new BadRequestException('El tipo de archivo no está permitido');
  if (!contentMatches(mimeType, buffer)) {
    throw new BadRequestException('El contenido del archivo no coincide con el tipo declarado');
  }
  return { extension: MIME_EXTENSIONS[mimeType] };
}

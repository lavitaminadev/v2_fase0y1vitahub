import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validateFileContent } from '../../../src/modules/uploads/file-content-validator';

describe('validateFileContent', () => {
  it('accepts a matching PNG signature and derives a safe extension', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(validateFileContent('image/png', png)).toEqual({ extension: '.png' });
  });

  it('rejects executable content disguised with an allowed MIME type', () => {
    expect(() => validateFileContent('image/png', Buffer.from('<?php echo 1; ?>'))).toThrow(BadRequestException);
  });

  it('rejects binary content declared as text', () => {
    expect(() => validateFileContent('text/plain', Buffer.from([0x00, 0xff, 0x00]))).toThrow(BadRequestException);
  });

  it('validates the internal marker of OOXML documents', () => {
    const fakeDocx = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('[Content_Types].xml word/document.xml'),
    ]);
    expect(validateFileContent('application/vnd.openxmlformats-officedocument.wordprocessingml.document', fakeDocx))
      .toEqual({ extension: '.docx' });
    expect(() => validateFileContent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fakeDocx))
      .toThrow(BadRequestException);
  });
});

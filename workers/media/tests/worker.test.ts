import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { MediaWorker, ImageProcessor } from '../src/index.js';

describe('@platform/worker-media: SEC-07 Image Processing & Hardening', () => {
  it('instantiates the media worker with correct lifecycle states', async () => {
    const worker = new MediaWorker();
    expect(worker.name).toBe('worker-media');
    expect(worker.isRunning).toBe(false);

    await worker.start();
    expect(worker.isRunning).toBe(true);

    await worker.stop();
    expect(worker.isRunning).toBe(false);
  });

  describe('ImageProcessor Validation & Transformation', () => {
    const processor = new ImageProcessor({ maxPixels: 500_000 });

    it('accurately validates PNG magic bytes and rejects counterfeit formats', async () => {
      // 1. Generate real valid PNG buffer
      const validPng = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 220, g: 20, b: 60 },
        },
      })
        .png()
        .toBuffer();

      expect(processor.validateMagicBytes(validPng)).toBe(true);

      // 2. Reject arbitrary text payload pretending to be an image
      const textBuffer = Buffer.from('GIF89a; <?php echo "malicious"; ?>');
      expect(processor.validateMagicBytes(textBuffer)).toBe(false);

      // 3. Reject empty or truncated buffers
      expect(processor.validateMagicBytes(Buffer.alloc(4))).toBe(false);
    });

    it('processes raw image buffer into standard, thumbnail, and placeholder WebP representations', async () => {
      const rawPng = await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 3,
          background: { r: 10, g: 120, b: 240 },
        },
      })
        .png()
        .toBuffer();

      const result = await processor.processImage(rawPng);

      expect(result.format).toBe('webp');
      expect(result.width).toBe(400);
      expect(result.height).toBe(400);

      // Verify generated buffers
      expect(result.standard.length).toBeGreaterThan(0);
      expect(result.thumbnail.length).toBeGreaterThan(0);
      expect(result.placeholder.length).toBeGreaterThan(0);

      // Verify standard image dimensions with sharp metadata
      const standardMeta = await sharp(result.standard).metadata();
      expect(standardMeta.format).toBe('webp');
      expect(standardMeta.width).toBe(400);
      expect(standardMeta.height).toBe(400);

      // Verify thumbnail dimensions (320x320 cover)
      const thumbMeta = await sharp(result.thumbnail).metadata();
      expect(thumbMeta.format).toBe('webp');
      expect(thumbMeta.width).toBe(320);
      expect(thumbMeta.height).toBe(320);

      // Verify placeholder dimensions (32x32)
      const placeholderMeta = await sharp(result.placeholder).metadata();
      expect(placeholderMeta.format).toBe('webp');
      expect(placeholderMeta.width).toBe(32);
      expect(placeholderMeta.height).toBe(32);
    });

    it('rejects decompression bomb images that exceed maxPixels limit', async () => {
      // Configured maxPixels is 500_000. 1000x600 = 600_000 pixels.
      const largePng = await sharp({
        create: {
          width: 1000,
          height: 600,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      await expect(processor.processImage(largePng)).rejects.toThrow(/exceeds.*pixel/i);
    });

    it('rejects non-image payloads when attempting to process', async () => {
      const fakePayload = Buffer.from('This is not an image');
      await expect(processor.processImage(fakePayload)).rejects.toThrow(/Invalid image binary/);
    });
  });

  describe('MediaWorker execution', () => {
    it('executes job and returns processed image output', async () => {
      const worker = new MediaWorker();
      const testBuffer = await sharp({
        create: {
          width: 120,
          height: 120,
          channels: 3,
          background: { r: 50, g: 200, b: 50 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await worker.processJob({
        mediaId: 'media_test_01',
        storageKey: 'profiles/usr_1/media_test_01/original',
        mimeType: 'image/jpeg',
        buffer: testBuffer,
      });

      expect(result.format).toBe('webp');
      expect(result.standard.length).toBeGreaterThan(0);
    });
  });
});

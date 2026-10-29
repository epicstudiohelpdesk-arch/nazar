import sharp from 'sharp';

export interface ProcessedImageResult {
  readonly format: 'webp';
  readonly width: number;
  readonly height: number;
  readonly standard: Buffer;
  readonly thumbnail: Buffer;
  readonly placeholder: Buffer;
  readonly originalSizeBytes: number;
  readonly processedSizeBytes: number;
}

export interface ImageProcessorOptions {
  readonly maxDimension?: number;
  readonly maxPixels?: number;
  readonly standardQuality?: number;
  readonly thumbnailQuality?: number;
}

export class ImageProcessor {
  private readonly maxDimension: number;
  private readonly maxPixels: number;
  private readonly standardQuality: number;
  private readonly thumbnailQuality: number;

  constructor(options: ImageProcessorOptions = {}) {
    this.maxDimension = options.maxDimension ?? 2048;
    this.maxPixels = options.maxPixels ?? 40_000_000; // 40 MP decompression bomb limit
    this.standardQuality = options.standardQuality ?? 85;
    this.thumbnailQuality = options.thumbnailQuality ?? 80;
  }

  /**
   * Validates image magic bytes against supported raster image signatures
   * (JPEG, PNG, WebP). Rejects polyglots, HTML, or corrupted files.
   */
  validateMagicBytes(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 12) return false;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return true;
    }

    // WebP: 'RIFF' .... 'WEBP'
    const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
    const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (isRiff && isWebp) {
      return true;
    }

    return false;
  }

  /**
   * Sanitizes, strips sensitive EXIF (GPS coordinates), and encodes optimized
   * responsive WebP representations.
   */
  async processImage(inputBuffer: Buffer): Promise<ProcessedImageResult> {
    if (!this.validateMagicBytes(inputBuffer)) {
      throw new Error('Invalid image binary: unsupported format or invalid magic bytes');
    }

    const image = sharp(inputBuffer, {
      failOn: 'error',
      limitInputPixels: this.maxPixels,
    });

    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Failed to read image dimensions');
    }

    if (metadata.width * metadata.height > this.maxPixels) {
      throw new Error(
        `Image exceeds maximum allowable pixel count (${metadata.width * metadata.height} > ${this.maxPixels})`
      );
    }

    // 1. Standard View (Max 1080x1350, Auto-orient, Strip EXIF metadata, WebP)
    const standard = await image
      .clone()
      .rotate() // auto-orient based on EXIF then discard EXIF
      .resize({
        width: Math.min(metadata.width, Math.min(1080, this.maxDimension)),
        height: Math.min(metadata.height, Math.min(1350, this.maxDimension)),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: this.standardQuality, effort: 4 })
      .toBuffer();

    // 2. Thumbnail Crop (320x320 cover, WebP)
    const thumbnail = await image
      .clone()
      .rotate()
      .resize(320, 320, { fit: 'cover', position: 'attention' })
      .webp({ quality: this.thumbnailQuality, effort: 3 })
      .toBuffer();

    // 3. Low-Quality Image Placeholder / Blur preview (32x32 cover, low quality)
    const placeholder = await image
      .clone()
      .rotate()
      .resize(32, 32, { fit: 'cover' })
      .webp({ quality: 20 })
      .toBuffer();

    return {
      format: 'webp',
      width: metadata.width,
      height: metadata.height,
      standard,
      thumbnail,
      placeholder,
      originalSizeBytes: inputBuffer.length,
      processedSizeBytes: standard.length,
    };
  }
}

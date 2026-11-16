import {
  AD_IMAGE_MAX_BYTES,
  adImagePath,
  checkAdImage,
  dataUrlToBlob,
  safeImageFileName,
} from './ad-image-storage';

describe('ad image storage helpers (#4)', () => {
  it('builds ad-images/{uid}/{adId}/{file} with a safe name and the right extension', () => {
    expect(adImagePath('alice', 'ad1', 'My Flyer (final).PNG', 'image/png', 42)).toBe(
      'ad-images/alice/ad1/42-My-Flyer-final.png'
    );
    expect(safeImageFileName('scan.pdf', 'image/png')).toBe('scan.png');
    expect(safeImageFileName('photo.jpeg', 'image/jpeg')).toBe('photo.jpg');
    expect(safeImageFileName('???', 'image/webp')).toBe('ad.webp');
  });

  it('accepts only jpeg/png/webp under 10 MB, like storage.rules', () => {
    expect(checkAdImage(new Blob(['x'], { type: 'image/png' }))).toBeNull();
    expect(checkAdImage(new Blob(['x'], { type: 'application/pdf' }))).toMatch(/JPEG, PNG, or WebP/);
    const big = { type: 'image/jpeg', size: AD_IMAGE_MAX_BYTES } as Blob;
    expect(checkAdImage(big)).toMatch(/10 MB/);
  });

  it('turns converter PNG data URLs into Blobs for upload', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,iVBORw==');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(4);
    expect(() => dataUrlToBlob('not a data url')).toThrow(/Unsupported/);
  });
});

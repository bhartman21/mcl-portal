import { Timestamp } from 'firebase/firestore';
import { adFromDoc, bookFromDoc, toIso } from './ad-book-firestore';

describe('Ad Book Firestore mapping (#4)', () => {
  it('converts Firestore timestamps to ISO strings', () => {
    const at = Timestamp.fromDate(new Date('2026-11-16T13:00:00Z'));
    expect(toIso(at)).toBe('2026-11-16T13:00:00.000Z');
    expect(toIso('2026-11-16')).toBe('2026-11-16');
    expect(toIso(null)).toBeUndefined();
  });

  it('never takes an image URL from Firestore; the image comes from imagePath', () => {
    const ad = adFromDoc('ad1', {
      title: 't',
      status: 'draft',
      imagePath: 'ad-images/alice/ad1/1-a.png',
      imageUrl: 'data:image/png;base64,AAAA',
      createdAt: Timestamp.fromDate(new Date('2026-11-16T13:00:00Z')),
    });
    expect(ad.id).toBe('ad1');
    expect(ad.imageUrl).toBeUndefined();
    expect(ad.imagePath).toBe('ad-images/alice/ad1/1-a.png');
    expect(ad.createdAt).toBe('2026-11-16T13:00:00.000Z');
  });

  it('books always have an adIds list', () => {
    expect(bookFromDoc('b1', { title: 'Convention', status: 'open' }).adIds).toEqual([]);
  });
});

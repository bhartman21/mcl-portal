import { unverifiedBannerParts } from './admin-detachments.component';

describe('unverifiedBannerParts', () => {
  it('uses singular grammar for one detachment', () => {
    expect(unverifiedBannerParts(1)).toEqual({
      subject: '1 detachment',
      verb: 'has',
      copula: 'is',
    });
  });

  it('uses plural grammar for more than one detachment', () => {
    expect(unverifiedBannerParts(4)).toEqual({
      subject: '4 detachments',
      verb: 'have',
      copula: 'are',
    });
  });
});

import { getSkillDisplayName } from './display';

describe('getSkillDisplayName', () => {
  it('uses displayTitle when it is present', () => {
    expect(getSkillDisplayName({ name: 'humanizer', displayTitle: '人性化改写' })).toBe(
      '人性化改写',
    );
  });

  it('falls back to name when displayTitle is blank', () => {
    expect(getSkillDisplayName({ name: 'anysearch', displayTitle: '  ' })).toBe('anysearch');
  });
});

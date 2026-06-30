const rootPackage = require('../../package.json');

describe('nodemonConfig', () => {
  it('ignores runtime file output directories', () => {
    expect(rootPackage.nodemonConfig.ignore).toEqual(
      expect.arrayContaining(['uploads/', 'logs/']),
    );
  });
});

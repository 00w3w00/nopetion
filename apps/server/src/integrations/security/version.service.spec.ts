import { VersionService } from './version.service';

describe('local version information', () => {
  it('reports the installed version offline without contacting an update server', async () => {
    const { version } = jest.requireActual('../../../package.json') as {
      version: string;
    };
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network is unavailable'));

    try {
      await expect(new VersionService().getVersion()).resolves.toEqual({
        currentVersion: version,
        latestVersion: version,
        releaseUrl: '',
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});

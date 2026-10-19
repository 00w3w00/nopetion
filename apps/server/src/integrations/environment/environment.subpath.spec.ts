import { ConfigService } from '@nestjs/config';
import { EnvironmentService } from './environment.service';

describe('application mount URL', () => {
  it.each([
    ['https://docs.example', 'https://docs.example', '/'],
    ['https://docs.example/', 'https://docs.example', '/'],
    ['https://docs.example/nopetion/', 'https://docs.example/nopetion', '/nopetion'],
  ])('preserves the public path and scopes authentication cookies for %s', (input, expected, path) => {
    const service = new EnvironmentService(new ConfigService({ APP_URL: input }));
    expect(service.getAppUrl()).toBe(expected);
    expect(service.getCookiePath()).toBe(path);
    expect(service.isHttps()).toBe(true);
  });
});

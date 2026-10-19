import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdatePageDto } from './update-page.dto';
import { UpdateUserDto } from '../../user/dto/update-user.dto';
import { CreatePageDto } from './create-page.dto';
describe('Personal presentation settings', () => {
  it('defaults template content to JSON when no format was sent', async () => {
    expect(
      await validate(
        plainToInstance(CreatePageDto, {
          spaceId: '01a124e8-d5bb-70c9-8a16-4f1b0a2cdf50',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        }),
      ),
    ).toHaveLength(0);
  });
  it('accepts built-in covers and local attachment references while rejecting URLs and malformed ids', async () => {
    for (const coverPhoto of [
      '',
      'nopetion:sage',
      'nopetion:sand',
      'nopetion:blue',
      'nopetion:ink',
      'nopetion:attachment:01a12888-df51-7466-88db-e8b8ee3d1009',
    ])
      expect(
        await validate(
          plainToInstance(UpdatePageDto, { pageId: 'page', coverPhoto }),
        ),
      ).toHaveLength(0);
    for (const coverPhoto of [
      'file:///etc/passwd',
      'http://localhost/admin',
      'https://example.com/image',
      'nopetion:attachment:not-a-uuid',
      'nopetion:attachment:01a12888-df51-7466-88db-e8b8ee3d1009/../../secret',
      123,
    ])
      expect(
        await validate(
          plainToInstance(UpdatePageDto, { pageId: 'page', coverPhoto }),
        ),
      ).not.toHaveLength(0);
  });
  it('validates the persisted font and small-text preference', async () => {
    expect(
      await validate(
        plainToInstance(UpdateUserDto, {
          documentFont: 'serif',
          smallText: true,
        }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(UpdateUserDto, {
          documentFont: 'url(file:///etc/passwd)',
          smallText: 'true',
        }),
      ),
    ).not.toHaveLength(0);
  });
});

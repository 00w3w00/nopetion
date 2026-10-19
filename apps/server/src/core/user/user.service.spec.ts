import { BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { validate } from 'class-validator';

describe('personal notification preferences', () => {
  function setup(personal = true) {
    const repo = {
      findById: jest.fn().mockResolvedValue({ id: 'owner', name: 'Owner' }),
      updateNotificationSetting: jest.fn().mockResolvedValue({ updated: true }),
      updatePreference: jest.fn().mockResolvedValue({ updated: true }),
    };
    const service = new UserService(
      repo as any, {} as any, { isPersonalMode: () => personal } as any,
    );
    return { repo, service };
  }

  it.each([
    'notificationPageUpdates', 'notificationPageUserMention',
    'notificationCommentUserMention', 'notificationCommentCreated',
    'notificationCommentResolved',
  ])('rejects the removed collaboration setting %s before accessing account data', async (field) => {
    const { repo, service } = setup();
    await expect(service.update(
      Object.assign(new UpdateUserDto(), { [field]: true }), 'owner', { id: 'workspace' } as any,
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.updateNotificationSetting).not.toHaveBeenCalled();
  });

  it('does not change existing collaboration preferences for a false value either', async () => {
    const { repo, service } = setup();
    await expect(service.update(
      { notificationPageUserMention: false } as UpdateUserDto,
      'owner', { id: 'workspace' } as any,
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateNotificationSetting).not.toHaveBeenCalled();
  });

  it('continues to save personal document appearance', async () => {
    const { repo, service } = setup();
    await service.update(
      { fullPageWidth: true } as UpdateUserDto, 'owner', { id: 'workspace' } as any,
    );
    expect(repo.updatePreference).toHaveBeenCalledWith('owner', 'fullPageWidth', true);
  });

  it('retains notification preferences outside personal mode', async () => {
    const { repo, service } = setup(false);
    await service.update(
      { notificationCommentCreated: false } as UpdateUserDto,
      'owner', { id: 'workspace' } as any,
    );
    expect(repo.updateNotificationSetting).toHaveBeenCalledWith('owner', 'comment.created', false);
  });

  it.each(['pretendard', 'inter', 'system', 'serif', 'mono'])('validates and saves the font %s for the authenticated owner', async (font) => {
    const { repo, service } = setup();
    const dto = Object.assign(new UpdateUserDto(), { appFont: font });
    expect(await validate(dto)).toEqual([]);
    await service.update(dto, 'owner', { id: 'workspace' } as any);
    expect(repo.updatePreference).toHaveBeenCalledWith('owner', 'appFont', font);
  });

  it.each(['https://fonts.example/custom.woff2', 'inherit', '__proto__', '', 1])('rejects unsupported font input %p at the API boundary', async (appFont) => {
    const errors = await validate(Object.assign(new UpdateUserDto(), { appFont }));
    expect(errors.some(error => error.property === 'appFont')).toBe(true);
  });
});

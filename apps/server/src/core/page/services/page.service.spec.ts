import { Test, TestingModule } from '@nestjs/testing';
import { PageService } from './page.service';
import { BadRequestException } from '@nestjs/common';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

describe('PageService', () => {
  let service: PageService;
  let attachmentRepo: AttachmentRepo;
  let pageRepo: PageRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PageService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<PageService>(PageService);
    attachmentRepo = module.get<AttachmentRepo>(AttachmentRepo);
    pageRepo = module.get<PageRepo>(PageRepo);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const page = {
    id: 'page',
    workspaceId: 'workspace',
    spaceId: 'space',
    contributorIds: [],
  };
  const attachment = {
    id: 'image',
    pageId: 'page',
    workspaceId: 'workspace',
    spaceId: 'space',
    type: 'file',
    mimeType: 'image/png',
    deletedAt: null,
  };
  const dto = { pageId: 'page', coverPhoto: 'nopetion:attachment:image' };

  it.each([
    undefined,
    { ...attachment, pageId: 'other-page' },
    { ...attachment, spaceId: 'other-space' },
    { ...attachment, workspaceId: 'other-workspace' },
    { ...attachment, deletedAt: new Date() },
    { ...attachment, type: 'avatar' },
    { ...attachment, mimeType: 'text/html' },
    { ...attachment, mimeType: 'image/svg+xml' },
  ])(
    'rejects a missing, foreign, deleted or non-raster attachment before modifying the page',
    async (invalid) => {
      attachmentRepo.findById = jest.fn().mockResolvedValue(invalid);
      pageRepo.updatePage = jest.fn();
      await expect(
        service.update(page as any, dto, { id: 'user' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(pageRepo.updatePage).not.toHaveBeenCalled();
    },
  );

  it.each(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])(
    'commits the cover for an owned %s attachment',
    async (mimeType) => {
      attachmentRepo.findById = jest
        .fn()
        .mockResolvedValue({ ...attachment, mimeType });
      pageRepo.updatePage = jest.fn().mockResolvedValue(undefined);
      pageRepo.findById = jest
        .fn()
        .mockResolvedValue({ ...page, coverPhoto: dto.coverPhoto });
      service['generalQueue'].add = jest.fn().mockResolvedValue(undefined);
      const result = await service.update(page as any, dto, {
        id: 'user',
      } as any);
      expect(pageRepo.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({ coverPhoto: dto.coverPhoto }),
        page.id,
      );
      expect(result.coverPhoto).toBe(dto.coverPhoto);
    },
  );
});

import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from './environment.service';
import { ConfigService } from '@nestjs/config';

describe('EnvironmentService', () => {
  let service: EnvironmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnvironmentService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<EnvironmentService>(EnvironmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('file size limits', () => {
    it.each([undefined, '', '   '])(
      'uses upload/import defaults for a missing or blank value %j',
      (value) => {
        const environment = new EnvironmentService(new ConfigService({
          FILE_UPLOAD_SIZE_LIMIT: value,
          FILE_IMPORT_SIZE_LIMIT: value,
        }));

        expect(environment.getFileUploadSizeLimit()).toBe('50mb');
        expect(environment.getFileImportSizeLimit()).toBe('200mb');
      },
    );

    it('preserves configured limits after trimming whitespace', () => {
      const environment = new EnvironmentService(new ConfigService({
        FILE_UPLOAD_SIZE_LIMIT: ' 2mb ',
        FILE_IMPORT_SIZE_LIMIT: ' 10mb ',
      }));

      expect(environment.getFileUploadSizeLimit()).toBe('2mb');
      expect(environment.getFileImportSizeLimit()).toBe('10mb');
    });
  });
});

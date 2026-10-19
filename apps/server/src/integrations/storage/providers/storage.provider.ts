import { STORAGE_CONFIG_TOKEN, STORAGE_DRIVER_TOKEN } from '../constants/storage.constants';
import { EnvironmentService } from '../../environment/environment.service';
import { StorageConfig, StorageOption } from '../interfaces';
import { LocalDriver } from '../drivers';
import { LOCAL_STORAGE_PATH } from '../../../common/helpers';

export const storageDriverConfigProvider = {
  provide: STORAGE_CONFIG_TOKEN,
  useFactory: (environmentService: EnvironmentService): StorageConfig => {
    if (environmentService.getStorageDriver().toLowerCase() !== StorageOption.LOCAL) {
      throw new Error('Only local attachment storage is supported');
    }
    return { driver: StorageOption.LOCAL, config: { storagePath: LOCAL_STORAGE_PATH } };
  },
  inject: [EnvironmentService],
};

export const storageDriverProvider = {
  provide: STORAGE_DRIVER_TOKEN,
  useFactory: (config: StorageConfig) => {
    if (config.driver !== StorageOption.LOCAL) throw new Error('Only local attachment storage is supported');
    return new LocalDriver(config.config);
  },
  inject: [STORAGE_CONFIG_TOKEN],
};

export enum StorageOption {
  LOCAL = 'local',
}

export type StorageConfig = { driver: StorageOption.LOCAL; config: LocalStorageConfig };

export interface LocalStorageConfig {
  storagePath: string;
}

export interface StorageOptions {
  disk: StorageConfig;
}

export interface StorageOptionsFactory {
  createStorageOptions(): Promise<StorageConfig> | StorageConfig;
}

export interface StorageModuleOptions {
  imports?: any[];
}

import { Injectable } from '@nestjs/common';

/** Commercial implementations are not part of the community build. Keeping
 * these core-facing predicates closed prevents stored flags or CLOUD from
 * enabling an implementation that is absent. Independent CE modules do not
 * use this service as an entitlement mechanism. */
@Injectable()
export class LicenseCheckService {
  isValidEELicense(_licenseKey: string): boolean { return false; }
  hasFeature(_licenseKey: string, _feature: string, _plan?: string): boolean { return false; }
  getFeatures(_licenseKey: string): string[] { return []; }
  resolveFeatures(_licenseKey: string, _plan: string): string[] { return []; }
  resolveTier(_licenseKey: string, _plan: string): string { return 'community'; }
}

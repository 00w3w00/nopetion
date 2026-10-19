import { Injectable } from '@nestjs/common';
import type { MailMessage } from './interfaces/mail.message';

// Kept as an internal adapter for legacy CE callers. This personal fork has
// no mail transport, body logging, email worker, or outbound email queueing.
@Injectable()
export class MailService {
  async sendEmail(_message: MailMessage): Promise<boolean> { return false; }
  async sendToQueue(_message: MailMessage): Promise<void> {}
}

import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class PersonalImageGuard extends JwtAuthGuard {
  constructor(reflector: Reflector, private readonly env: EnvironmentService) { super(reflector, env); }
  canActivate(ctx: ExecutionContext) { return this.env.isPersonalMode() ? super.canActivate(ctx) : true; }
}

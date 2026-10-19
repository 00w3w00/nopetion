import { BadRequestException, createParamDecorator } from '@nestjs/common';

export const AuthAccountUser = createParamDecorator((_, ctx) => {
  const auth = ctx.switchToHttp().getRequest().user;
  const user = auth?.accountUser ?? auth?.user;
  if (!user) throw new BadRequestException('Invalid User');
  return user;
});
export const AuthAccountWorkspace = createParamDecorator((_, ctx) => {
  const req = ctx.switchToHttp().getRequest();
  const workspace = req.user?.accountWorkspace ?? req.raw?.workspace ?? req.user?.workspace;
  if (!workspace) throw new BadRequestException('Invalid workspace');
  return workspace;
});

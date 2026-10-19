import { ArgumentMetadata, Injectable, PipeTransform, Type, ValidationPipe, mixin } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { CreateAdminUserDto } from './create-admin-user.dto';
import { LoginDto } from './login.dto';
import { ChangePasswordDto } from './change-password.dto';
import { PasswordResetDto } from './password-reset.dto';

export class PersonalPasswordDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class PersonalChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

export class PersonalPasswordResetDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

function authInputPipe(standard: Type, personal: Type): Type<PipeTransform> {
  @Injectable()
  class AuthInputPipe implements PipeTransform {
    private readonly validation = new ValidationPipe({ whitelist: true, stopAtFirstError: true, transform: true });

    constructor(private readonly environment: EnvironmentService) {}

    transform(value: unknown, metadata: ArgumentMetadata) {
      return this.validation.transform(value, {
        ...metadata,
        metatype: this.environment.isPersonalMode() ? personal : standard,
      });
    }
  }
  return mixin(AuthInputPipe);
}

export const SetupInputPipe = authInputPipe(CreateAdminUserDto, PersonalPasswordDto);
export const LoginInputPipe = authInputPipe(LoginDto, PersonalPasswordDto);
export const ChangePasswordInputPipe = authInputPipe(ChangePasswordDto, PersonalChangePasswordDto);
export const PasswordResetInputPipe = authInputPipe(PasswordResetDto, PersonalPasswordResetDto);

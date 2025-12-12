import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../entities/user.entity';

@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // If 2FA is enabled but not verified in this session, deny access
    if (user.twoFactorEnabled && !request.session?.twoFactorVerified) {
      throw new UnauthorizedException('Two-factor authentication required');
    }

    return true;
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../entities/user.entity';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET'),
      callbackURL:
        configService.get<string>('GITHUB_REDIRECT_URI') ||
        'http://localhost:3000/auth/oauth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<AuthResponseDto> {
    try {
      const { id, emails, displayName } = profile;

      if (!emails || emails.length === 0) {
        return done(new Error('No email found in GitHub profile'), undefined);
      }

      const email = emails[0].value;

      // Parse display name into first and last name
      const nameParts = (displayName || '').split(' ');
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.slice(1).join(' ') || undefined;

      // Login or register user via OAuth
      const authResponse = await this.authService.oauthLogin(
        AuthProvider.GITHUB,
        id,
        email,
        firstName,
        lastName,
      );

      return done(null, authResponse);
    } catch (error) {
      return done(error, undefined);
    }
  }
}

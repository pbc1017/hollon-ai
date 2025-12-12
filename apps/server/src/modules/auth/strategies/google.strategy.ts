import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../entities/user.entity';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL:
        configService.get<string>('GOOGLE_REDIRECT_URI') ||
        'http://localhost:3000/auth/oauth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<AuthResponseDto> {
    try {
      const { id, emails, name } = profile;

      if (!emails || emails.length === 0) {
        return done(new Error('No email found in Google profile'), undefined);
      }

      const email = emails[0].value;
      const firstName = name?.givenName;
      const lastName = name?.familyName;

      // Login or register user via OAuth
      const authResponse = await this.authService.oauthLogin(
        AuthProvider.GOOGLE,
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

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthProvider } from './entities/user.entity';
import { Public } from './decorators/public.decorator';

interface OAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

interface OAuthUserInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

@Controller('auth/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Initiate Google OAuth flow
   */
  @Public()
  @Get('google')
  googleLogin(@Res() res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/oauth/google/callback';
    const scope = 'openid email profile';
    const state = this.generateState();

    if (!clientId) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}&` +
      `access_type=offline&` +
      `prompt=consent`;

    return res.redirect(authUrl);
  }

  /**
   * Google OAuth callback
   */
  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query() query: OAuthCallbackQuery,
    @Res() res: Response,
  ) {
    const { code, error } = query;

    if (error) {
      this.logger.error(`Google OAuth error: ${error}`);
      return res.redirect(`/login?error=${error}`);
    }

    if (!code) {
      return res.redirect('/login?error=no_code');
    }

    try {
      // Exchange code for tokens
      const tokens = await this.exchangeGoogleCode(code);

      // Get user info
      const userInfo = await this.getGoogleUserInfo(tokens.access_token);

      // Login or create user
      const authResponse = await this.authService.oauthLogin(
        AuthProvider.GOOGLE,
        userInfo.id,
        userInfo.email,
        userInfo.firstName,
        userInfo.lastName,
      );

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(
        `${frontendUrl}/auth/callback?` +
        `access_token=${authResponse.accessToken}&` +
        `refresh_token=${authResponse.refreshToken}`
      );
    } catch (error) {
      this.logger.error('Google OAuth callback error:', error);
      return res.redirect('/login?error=oauth_failed');
    }
  }

  /**
   * Initiate GitHub OAuth flow
   */
  @Public()
  @Get('github')
  githubLogin(@Res() res: Response) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/oauth/github/callback';
    const scope = 'user:email';
    const state = this.generateState();

    if (!clientId) {
      throw new BadRequestException('GitHub OAuth is not configured');
    }

    const authUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}`;

    return res.redirect(authUrl);
  }

  /**
   * GitHub OAuth callback
   */
  @Public()
  @Get('github/callback')
  async githubCallback(
    @Query() query: OAuthCallbackQuery,
    @Res() res: Response,
  ) {
    const { code, error } = query;

    if (error) {
      this.logger.error(`GitHub OAuth error: ${error}`);
      return res.redirect(`/login?error=${error}`);
    }

    if (!code) {
      return res.redirect('/login?error=no_code');
    }

    try {
      // Exchange code for token
      const tokens = await this.exchangeGitHubCode(code);

      // Get user info
      const userInfo = await this.getGitHubUserInfo(tokens.access_token);

      // Login or create user
      const authResponse = await this.authService.oauthLogin(
        AuthProvider.GITHUB,
        userInfo.id,
        userInfo.email,
        userInfo.firstName,
        userInfo.lastName,
      );

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(
        `${frontendUrl}/auth/callback?` +
        `access_token=${authResponse.accessToken}&` +
        `refresh_token=${authResponse.refreshToken}`
      );
    } catch (error) {
      this.logger.error('GitHub OAuth callback error:', error);
      return res.redirect('/login?error=oauth_failed');
    }
  }

  // ===== Private Helper Methods =====

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  private async exchangeGoogleCode(code: string): Promise<{ access_token: string; id_token: string }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/oauth/google/callback';

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange Google code');
    }

    return response.json();
  }

  private async getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get Google user info');
    }

    const data = await response.json();

    return {
      id: data.id,
      email: data.email,
      firstName: data.given_name,
      lastName: data.family_name,
    };
  }

  private async exchangeGitHubCode(code: string): Promise<{ access_token: string }> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/oauth/github/callback';

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange GitHub code');
    }

    return response.json();
  }

  private async getGitHubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // Get user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get GitHub user info');
    }

    const userData = await userResponse.json();

    // Get user emails
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    let email = userData.email;

    if (!email && emailsResponse.ok) {
      const emails = await emailsResponse.json();
      const primaryEmail = emails.find((e: any) => e.primary);
      email = primaryEmail?.email || emails[0]?.email;
    }

    if (!email) {
      throw new Error('No email found in GitHub account');
    }

    // Parse name
    const nameParts = (userData.name || '').split(' ');
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(' ') || undefined;

    return {
      id: userData.id.toString(),
      email,
      firstName,
      lastName,
    };
  }
}

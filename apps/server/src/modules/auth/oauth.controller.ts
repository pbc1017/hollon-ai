import { Controller, Get, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { AuthResponseDto } from './dto/auth-response.dto';

@Controller('auth/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Initiate Google OAuth flow
   */
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Guard redirects to Google
  }

  /**
   * Google OAuth callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    try {
      // User is authenticated by GoogleStrategy
      const authResponse = req.user as AuthResponseDto;

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(
        `${frontendUrl}/auth/callback?` +
          `access_token=${authResponse.accessToken}&` +
          `refresh_token=${authResponse.refreshToken}`,
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
  @UseGuards(GitHubAuthGuard)
  githubLogin() {
    // Guard redirects to GitHub
  }

  /**
   * GitHub OAuth callback
   */
  @Public()
  @Get('github/callback')
  @UseGuards(GitHubAuthGuard)
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    try {
      // User is authenticated by GitHubStrategy
      const authResponse = req.user as AuthResponseDto;

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(
        `${frontendUrl}/auth/callback?` +
          `access_token=${authResponse.accessToken}&` +
          `refresh_token=${authResponse.refreshToken}`,
      );
    } catch (error) {
      this.logger.error('GitHub OAuth callback error:', error);
      return res.redirect('/login?error=oauth_failed');
    }
  }
}

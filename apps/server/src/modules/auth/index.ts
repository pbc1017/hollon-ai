// Module
export { AuthModule } from './auth.module';

// Services
export { AuthService } from './auth.service';

// Controllers
export { AuthController } from './auth.controller';
export { OAuthController } from './oauth.controller';

// Entities
export { User, AuthProvider } from './entities/user.entity';
export { Session } from './entities/session.entity';

// DTOs
export { RegisterDto } from './dto/register.dto';
export { LoginDto } from './dto/login.dto';
export { RefreshTokenDto } from './dto/refresh-token.dto';
export { Enable2FADto } from './dto/enable-2fa.dto';
export { Verify2FADto } from './dto/verify-2fa.dto';
export { AuthResponseDto, TwoFactorChallengeDto } from './dto/auth-response.dto';

// Guards
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { TwoFactorGuard } from './guards/two-factor.guard';

// Decorators
export { Public } from './decorators/public.decorator';
export { CurrentUser } from './decorators/current-user.decorator';

// Strategies
export { JwtStrategy } from './strategies/jwt.strategy';

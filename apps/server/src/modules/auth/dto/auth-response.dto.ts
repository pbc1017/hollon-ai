export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    twoFactorEnabled: boolean;
  };
}

export class TwoFactorChallengeDto {
  requiresTwoFactor: true;
  tempToken: string;
}

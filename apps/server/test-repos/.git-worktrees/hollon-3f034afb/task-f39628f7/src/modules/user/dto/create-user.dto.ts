import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsUUID()
  organizationId: string;
}

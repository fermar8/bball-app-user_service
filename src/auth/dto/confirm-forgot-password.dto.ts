import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ConfirmForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: 'Confirmation code from email' })
  @IsString()
  @Length(6, 6)
  confirmationCode: string;

  @ApiProperty({ example: 'NewPassword123!', description: 'New password (min 8 characters)' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

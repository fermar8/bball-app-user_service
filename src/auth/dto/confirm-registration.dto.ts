import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class ConfirmRegistrationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: 'Confirmation code from email' })
  @IsString()
  @Length(6, 6)
  confirmationCode: string;
}

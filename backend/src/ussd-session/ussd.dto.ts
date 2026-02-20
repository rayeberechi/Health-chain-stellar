import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UssdSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  serviceCode: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @Transform(({ value }) => value ?? '')
  text: string;

  @IsOptional()
  @IsString()
  networkCode?: string;

  @IsOptional()
  @IsString()
  operator?: string;
}

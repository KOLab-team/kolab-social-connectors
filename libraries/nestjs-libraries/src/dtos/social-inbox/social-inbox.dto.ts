import { SocialConversationStatus, SocialInboxPlatform } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SocialInboxQueryDto {
  @IsOptional()
  @IsEnum(SocialConversationStatus)
  status?: SocialConversationStatus;

  @IsOptional()
  @IsEnum(SocialInboxPlatform)
  platform?: SocialInboxPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SendSocialInboxMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientRequestId?: string;
}

export class UpdateSocialConversationDto {
  @IsEnum(SocialConversationStatus)
  status: SocialConversationStatus;
}

export class AddSocialInboxNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

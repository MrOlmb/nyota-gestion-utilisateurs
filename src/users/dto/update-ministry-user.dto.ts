import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateMinistryUserDto } from './create-ministry-user.dto';

export class UpdateMinistryUserDto extends PartialType(
  OmitType(CreateMinistryUserDto, ['password'] as const)
) {
  // All fields from CreateMinistryUserDto are now optional except password
  // Password updates should be handled separately for security reasons
}
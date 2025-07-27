import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateSchoolUserDto } from './create-school-user.dto';

export class UpdateSchoolUserDto extends PartialType(
  OmitType(CreateSchoolUserDto, ['password'] as const)
) {
  // All fields from CreateSchoolUserDto are now optional except password
  // Password updates should be handled separately for security reasons
}
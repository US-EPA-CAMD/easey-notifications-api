import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  ValidationArguments,
  IsEnum,
  Length,
} from 'class-validator';

import { Status } from '../enums/status.enum';
import { Type } from 'class-transformer';
import { Plant } from '../entities/plant.entity';
import { IsValidCode, IsInRange } from '@us-epa-camd/easey-common/pipes';
import { MonitorPlan } from '../entities/monitor-plan.entity';
import { CheckCatalogService } from '@us-epa-camd/easey-common/check-catalog';

export class EmSubmissionAccessParamsDTO {
  @IsOptional()
  @ApiProperty()
  @IsValidCode(Plant, {
    message: (args: ValidationArguments) => {
      return `The ${args.property} is not valid. Refer to the list of available facilityRecordIds for valid values '/facilities-mgmt/facilities'`;
    },
  })
  @Type(() => Number)
  facilityId?: number;

  @IsOptional()
  @ApiProperty()
  @IsValidCode(MonitorPlan, {
    message: (args: ValidationArguments) => {
      return CheckCatalogService.formatMessage(
        'The reported a invalid [property].',
        {
          property: args.property,
        },
      );
    },
  })
  monitorPlanId?: string;

  @IsOptional()
  @ApiProperty()
  @Length(4, 4, {
    message: (args: ValidationArguments) => {
      return CheckCatalogService.formatMessage(
        `Ensure the year format is YYYY.`,
        {
          value: args.value,
        },
      );
    },
  })
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @ApiProperty()
  @IsInRange(1, 4, {
    message: (args: ValidationArguments) => {
      return CheckCatalogService.formatMessage(
        `Ensure that the Quarter value is a number from 1 to 4.`,
        {
          value: args.value,
        },
      );
    },
  })
  @Type(() => Number)
  quarter?: number;

  @IsOptional()
  @ApiProperty({ enum: Status })
  @IsEnum(Status, {
    message: () => {
      return CheckCatalogService.formatMessage(
        `The status must have a value of OPEN,PENDING or CLOSED,`,
      );
    },
  })
  status?: string;
}
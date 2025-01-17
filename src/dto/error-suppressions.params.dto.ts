import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidationArguments,
} from 'class-validator';

import { SeverityCodes } from '../enums/severity-codes.enum';
import { ReasonCodes } from '../enums/reason-codes.enum';
import { IsValidCode } from '@us-epa-camd/easey-common/pipes';
import { SeverityCode } from '../entities/severity-code.entity';
import { CheckCatalogService } from '@us-epa-camd/easey-common/check-catalog';
import { IsDateHrQtrFormat } from '../pipes/is-date-hr-qtr-format.pipe';
import { FindOneOptions } from 'typeorm/find-options/FindOneOptions';
import { CheckCatalog } from '../entities/check-catalog.entity';
import { CheckCatalogResult } from '../entities/check-catalog-result.entity';
import { Plant } from '../entities/plant.entity';
import { EsReasonCode } from '../entities/es-reason-code.entity';
import { ErrorMessages } from '@us-epa-camd/easey-common/constants';

const msgA =
  'The [property] is not valid refer to the list of available [property]s for valid values';
const msgB = `Ensure [property] are in the following formats Date Range - YYYY-mm-dd /Hour Range- YYYY-mm-dd hh/Quarter Range – YYYY Q1/Q2/Q3/Q4`;

export class ErrorSuppressionsParamsDTO {
  @IsNotEmpty({
    message: () => {
      return ErrorMessages.RequiredProperty();
    },
  })
  @ApiProperty()
  @IsString()
  @IsValidCode(
    CheckCatalog,
    {
      message: (args: ValidationArguments) => {
        return CheckCatalogService.formatMessage(msgA, {
          property: args.property,
          value: args.value,
        });
      },
    },
    (args: ValidationArguments): FindOneOptions<CheckCatalog> => {
      return { where: { checkTypeCode: args.value } };
    },
  )
  checkTypeCode: string;

  @IsNotEmpty({
    message: () => {
      return ErrorMessages.RequiredProperty();
    },
  })
  @ApiProperty()
  @Allow()
  @IsValidCode(
    CheckCatalog,
    {
      message: (args: ValidationArguments) => {
        return CheckCatalogService.formatMessage(msgA, {
          property: args.property,
          value: args.value,
        });
      },
    },
    (args: ValidationArguments): FindOneOptions<CheckCatalog> => {
      return {
        where: {
          checkTypeCode: args.object['checkTypeCode'],
          checkNumber: args.value,
        },
      };
    },
  )
  checkNumber: number;

  @IsNotEmpty({
    message: () => {
      return ErrorMessages.RequiredProperty();
    },
  })
  @ApiProperty()
  @IsString()
  @IsValidCode(
    CheckCatalogResult,
    {
      message: (args: ValidationArguments) => {
        return CheckCatalogService.formatMessage(msgA, {
          property: args.property,
          value: args.value,
        });
      },
    },
    (args: ValidationArguments): FindOneOptions<CheckCatalogResult> => {
      return {
        where: {
          checkCatalog: {
            checkTypeCode: args.object['checkTypeCode'],
            checkNumber: args.object['checkNumber'],
          },
          checkResult: args.value,
        },
        relations: ['checkCatalog'],
      };
    },
  )
  checkResult: string;

  @IsOptional()
  @ApiProperty({ enum: SeverityCodes })
  @IsString()
  @IsValidCode(SeverityCode, {
    message: (args: ValidationArguments) => {
      return CheckCatalogService.formatMessage(msgA, {
        property: args.property,
        value: args.value,
      });
    },
  })
  severityCode?: string;

  @IsValidCode(
    Plant,
    {
      message: (args: ValidationArguments) => {
        return `The ${args.property} is not valid. Refer to the list of available facilityIds for valid values '/facilities-mgmt/facilities'`;
      },
    },
    (args: ValidationArguments): FindOneOptions<Plant> => {
      return {
        where: {
          orisCode: args.value,
        },
      };
    },
  )
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  orisCode?: number;

  @IsOptional()
  @ApiProperty({ isArray: true })
  @Transform(({ value }) => value.split('|').map((item) => item.trim()))
  @IsArray()
  locations?: string[];

  @IsOptional()
  @ApiProperty({ enum: ReasonCodes })
  @IsString()
  @IsValidCode(EsReasonCode, {
    message: (args: ValidationArguments) => {
      return CheckCatalogService.formatMessage(msgA, {
        property: args.property,
        value: args.value,
      });
    },
  })
  reasonCode?: string;

  @IsOptional()
  @ApiProperty()
  @IsString()
  @IsDateHrQtrFormat({
    message: (args: ValidationArguments) => {
      return CheckCatalogService.formatMessage(msgB, {
        property: args.property,
      });
    },
  })
  addDateAfter?: string;

  @IsOptional()
  @ApiProperty()
  @IsString()
  @IsDateHrQtrFormat({
    message: (args: ValidationArguments) => {
      return CheckCatalogService.formatMessage(msgB, {
        property: args.property,
      });
    },
  })
  addDateBefore?: string;

  @IsOptional()
  @ApiProperty()
  @IsBoolean()
  @Transform(({ value }) => {
    if (String(value).toLowerCase() === 'true') return true;
    if (String(value).toLowerCase() === 'false') return false;
    return null;
  })
  active?: boolean;
}

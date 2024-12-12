import {
  Controller,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiExcludeController, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MatsFileUploadService } from './mats-file-upload.service';
import { EaseyException } from '@us-epa-camd/easey-common/exceptions';
import { RoleGuard, User } from '@us-epa-camd/easey-common/decorators';
import { CurrentUser } from '@us-epa-camd/easey-common/interfaces';
import { LookupType } from '@us-epa-camd/easey-common/enums';
import { ConfigService } from '@nestjs/config';

const MAX_UPLOAD_SIZE_MB: number = 30;

@Controller()
@ApiTags('MATs File Upload')
@ApiSecurity('APIKey')
@ApiExcludeController()
export class MatsFileUploadController {
  constructor(
    private configService: ConfigService,
    private service: MatsFileUploadService,
  ) {}

  @Post(':monPlanId/:locId/:testGroupCode/:testNumber/import')
  @ApiConsumes('multipart/form-data')
  @RoleGuard(
    {
      enforceCheckout: true,
      pathParam: 'monPlanId',
      requiredRoles: ['Submitter', 'Preparer', 'Sponsor', 'Initial Authorizer'],
      permissionsForFacility: ['DSQA'],
    },
    LookupType.MonitorPlan,
  )
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Param('monPlanId') monPlanId: string,
    @Param('locId') locId: string,
    @Param('testGroupCode') testGroupCode: string,
    @Param('testNumber') testNumber: string,
    @User() user: CurrentUser,
  ) {
    const fileErrors = [];

    if (
      file.size >
      this.configService.get<number>('app.maxMatsUploadSizeMB') * 1024 * 1024
    )
      fileErrors.push(
        `Uploaded file exceeds maximum size of ${MAX_UPLOAD_SIZE_MB}MB`,
      );
    if (
      ![
        'application/pdf', 'application/xml', 'text/xml',
        'application/json', 'text/json'
      ].includes(
        file.mimetype,
      )
    )
      fileErrors.push('Only XML, PDF, and JSON files may be uploaded');

    if (fileErrors.length > 0) {
      throw new EaseyException(
        new Error(fileErrors.join('\n')),
        HttpStatus.BAD_REQUEST,
        { responseObject: fileErrors },
      );
    }

    await this.service.importFile(
      file,
      monPlanId,
      locId,
      testGroupCode,
      testNumber,
      user.userId,
    );
  }
}

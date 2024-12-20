import {
  ApiTags,
  ApiOkResponse,
  ApiSecurity,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { ClientTokenGuard } from '@us-epa-camd/easey-common/guards';
import { ServerErrorDto } from '../dto/server-error.dto';
import { ApiExcludeControllerByEnv } from '../decorators/swagger-decorator';

@Controller()
@ApiTags('Logging')
@ApiSecurity('APIKey')
@ApiSecurity('ClientId')
@ApiBearerAuth('ClientToken')
@UseGuards(ClientTokenGuard)
@ApiExcludeControllerByEnv()
export class LoggingController {
  constructor(private loggingService: LoggingService) {}

  @Post('error')
  @ApiOkResponse({
    description: 'Data created successfully',
  })
  @ApiOperation({
    description: 'Logging services for CAMD applications.',
  })
  @ApiInternalServerErrorResponse()
  async serverError(@Req() request, @Body() serverErrorDto: ServerErrorDto) {
    await this.loggingService.logServerError(request, serverErrorDto);
  }
}

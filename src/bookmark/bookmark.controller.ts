import {
  ApiTags,
  ApiOkResponse,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';

import { ClientTokenGuard } from '@us-epa-camd/easey-common/guards';
import {
  DataDictionary,
  OverrideKeys,
  PropertyKeys,
} from '@us-epa-camd/easey-common/data-dictionary';

import { BookmarkService } from './bookmark.service';
import { BoomarkPayloadDTO } from '../dto/bookmark-payload.dto';
import { BookmarkCreatedDTO } from '../dto/bookmark-created.dto';
import { BookmarkDTO } from '../dto/bookmark.dto';
import { ApiExcludeControllerByEnv } from '../decorators/swagger-decorator';

@Controller()
@ApiSecurity('APIKey')
@ApiTags('Bookmarks')
@ApiExcludeControllerByEnv()
export class BookmarkController {
  constructor(private service: BookmarkService) {}

  @Get(':id')
  @ApiOkResponse({
    type: BookmarkDTO,
    description: 'Data retrieved successfully',
  })
  @ApiOperation({
    description: 'Retrieves a CAMPD application bookmark by its id.',
  })
  @ApiParam({
    name: 'id',
    ...DataDictionary.getMetadata(PropertyKeys.ID, OverrideKeys.BOOKMARK, true),
  })
  async getBookmarkById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BookmarkDTO> {
    return this.service.getBookmarkById(id);
  }

  @Post()
  @ApiSecurity('ClientId')
  @ApiBearerAuth('ClientToken')
  @UseGuards(ClientTokenGuard)
  @ApiOkResponse({
    type: BookmarkCreatedDTO,
    description: 'Data created successfully',
  })
  @ApiOperation({
    description: 'Creates a CAMPD application bookmark.',
  })
  async createBookmark(
    @Body() payload: BoomarkPayloadDTO,
  ): Promise<BookmarkCreatedDTO> {
    return this.service.createBookmark(payload);
  }
}

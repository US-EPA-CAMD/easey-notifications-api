import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { QaTeeMaintView } from '../entities/qa-tee-maint-vw.entity';
import { currentDateTime } from '@us-epa-camd/easey-common/utilities/functions';
import { EaseyException } from '@us-epa-camd/easey-common/exceptions';
import { QaUpdateDto } from '../dto/qa-update.dto';

@Injectable()
export class QaTestExtensionExemptionService {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
  ) {}

  getQaTeeViewData(
    orisCode: number,
    unitStack: string,
  ): Promise<QaTeeMaintView[]> {
    const where = {
      orisCode,
    } as any;

    if (unitStack !== null && unitStack !== undefined)
      where.unitStack = unitStack;

    return this.manager.find(QaTeeMaintView, {
      where,
    });
  }

  async updateSubmissionStatus(
    id: string,
    userId: string,
    payload: QaUpdateDto,
  ): Promise<QaTeeMaintView> {
    let recordToUpdate: QaTeeMaintView;

    try {
      // UPDATE OFFICIAL TABLE
      await this.manager.query(
        `UPDATE camdecmps.test_extension_exemption 
      SET submission_availability_cd = $2,
      userid = $3,
      update_date = $4,
      resub_explanation = $5
      WHERE test_extension_exemption_id = $1`,
        [id, 'REQUIRE', userId, currentDateTime(), payload?.resubExplanation],
      );
      recordToUpdate = await this.manager.findOne(QaTeeMaintView, id);
      if (!recordToUpdate)
        throw new EaseyException(
          new Error(`Record with id ${id} not found`),
          HttpStatus.NOT_FOUND,
        );
    } catch (e) {
      throw new EaseyException(e, e.status);
    }

    return recordToUpdate;
  }

  async deleteQACertTeeData(id: string): Promise<any> {
    try {
      // DELETE FROM OFFICIAL TABLE
      await this.manager.query(
        `DELETE FROM camdecmps.test_extension_exemption 
        WHERE test_extension_exemption_id = $1`,
        [id],
      );
    } catch (e) {
      throw new EaseyException(e, e.status);
    }

    return {
      message: `Record with id ${id} has been successfully deleted.`,
    };
  }
}

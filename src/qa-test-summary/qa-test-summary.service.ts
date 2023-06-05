import { Injectable } from '@nestjs/common';
import { EntityManager, getManager } from 'typeorm';
import { QaTestSummaryMaintView } from '../entities/qa-test-summary-maint-vw.entity';
import { InjectEntityManager } from '@nestjs/typeorm';

@Injectable()
export class QaTestSummaryService {
    
    constructor(
        @InjectEntityManager()
        private readonly manager: EntityManager
    ){}
    async getQaTestSummaryData(orisCode: number, unitStack: string): Promise<QaTestSummaryMaintView[]> {
        // const manager = getManager();

        const where = {
            orisCode
        } as any;

        if (unitStack !== null && unitStack !== undefined)
            where.unitStack = unitStack;

        return this.manager.find(QaTestSummaryMaintView, {
            where
        })
    }
}

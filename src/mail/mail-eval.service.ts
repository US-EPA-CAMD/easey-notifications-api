import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Evaluation } from '../entities/evaluation.entity';
import { EvaluationSet } from '../entities/evaluation-set.entity';
import { MonitorPlan } from '../entities/monitor-plan.entity';
import { Plant } from '../entities/plant.entity';
import { TestSummary } from '../entities/test-summary.entity';
import { MonitorSystem } from '../entities/monitor-system.entity';
import { Component } from '../entities/component.entity';
import { CountyCode } from '../entities/county-code.entity';
import { QaCertEvent } from '../entities/qa-cert-event.entity';
import { QaTee } from '../entities/qa-tee.entity';
import { ReportingPeriod } from '../entities/reporting-period.entity';
import { EmissionEvaluation } from '../entities/emission-evaluation.entity';
import { ConfigService } from '@nestjs/config';
import { SubmissionQueue } from '../entities/submission-queue.entity';
import { SubmissionSet } from '../entities/submission-set.entity';
import { MatsBulkFile } from '../entities/mats-bulk-file.entity';
import { MonitorPlanGlobal } from '../entities/monitor-plan-global.entity';
import { TestSummaryGlobal } from '../entities/test-summary-global.entity';
import { QaCertEventGlobal } from '../entities/qa-cert-event-global.entity';
import { QaTeeGlobal } from '../entities/qa-tee-global.entity';
import { EmissionEvaluationGlobal } from '../entities/emission-evaluation-global.entity';
import { EaseyException } from '@us-epa-camd/easey-common/exceptions';
import { ReportParamsDTO } from '../dto/report-params.dto';
import { DataSetService } from '../dataset/dataset.service';
import { CopyOfRecordService } from '../copy-of-record/copy-of-record.service';

//Formats and sends emissions evaluations emails
@Injectable()
export class MailEvalService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private dataSetService: DataSetService,
    private copyOfRecordService: CopyOfRecordService,
  ) {}

  returnManager() {
    return this.entityManager;
  }

  getReportColors(evalStatusCd: string) {
    if (evalStatusCd !== 'PASS' && evalStatusCd !== 'INFO') {
      return ['#faf3d1', '#ffbe2e'];
    }
    return ['#ecf3ec', '#00a91c'];
  }

  async getSystemComponentIdentifier(
    monitorSystem: string,
    componentId: string,
  ) {
    if (monitorSystem) {
      const ms = await this.returnManager().findOneBy(MonitorSystem, {
        monSystemIdentifier: monitorSystem,
      });
      if (ms && ms.systemIdentifier) {
        return ms.systemIdentifier;
      }
    }
    if (componentId) {
      const c = await this.returnManager().findOneBy(Component, {
        componentId,
      });
      return c.componentIdentifier;
    }
  }

  async formatTestDataContext(
    templateContext: Record<string, any>,
    records: Array<Evaluation | SubmissionQueue>,
    orisCode: number | null,
    mappedStatusCodes: Map<string, string>,
  ) {
    const testDataKeys = [
      'System / Component Id',
      'Test Number',
      'Test Type',
      'Test Reason',
      'Test Result',
    ];

    testDataKeys.push('Evaluation Status Code');

    if (records.length > 0) {
      templateContext['testData'] = {
        keys: testDataKeys,
        items: [],
      };
      for (const testRecord of records) {
        const newItem: any = {};
        const testSumRecord: TestSummary | TestSummaryGlobal | null =
          testRecord.testSumIdentifier &&
          (await this.returnManager().findOneBy(
            TestSummary,
            { testSumIdentifier: testRecord.testSumIdentifier },
          ));

        if (testSumRecord) {
          newItem['System / Component Id'] =
            await this.getSystemComponentIdentifier(
              testSumRecord.monSystemIdentifier,
              testSumRecord.componentIdentifier,
            );
          newItem['Test Number'] = testSumRecord.testNumber;
          newItem['Test Type'] = testSumRecord.testTypeCode;
          newItem['Test Reason'] = testSumRecord.testReasonCode;
          newItem['Test Result'] = testSumRecord.testResultCode;
          if (testSumRecord instanceof TestSummary) {
            newItem['evalStatusCode'] = mappedStatusCodes.get(
              testSumRecord.evalStatusCode,
            );
            const colors = this.getReportColors(testSumRecord.evalStatusCode);
            newItem['reportColor'] = colors[0];
            newItem['reportLineColor'] = colors[1];
          }

          newItem['reportUrl'] = `${this.configService.get<string>(
            'app.ecmpsHost',
          )}/workspace/reports?reportCode=TEST_EVAL&facilityId=${orisCode}&testId=${
            testSumRecord.testSumIdentifier
          }`;

          templateContext['testData'].items.push(newItem);
        }
      }
    }
    return templateContext;
  }

  async formatCertEventsContext(
    templateContext: Record<string, any>,
    records: Array<Evaluation | SubmissionQueue>,
    orisCode: number | null,
    mappedStatusCodes: Map<string, string>,
  ) {
    const certEventKeys = [
      'System / Component Id',
      'Cert Event Code',
      'Required Test Code',
    ];

    certEventKeys.push('Evaluation Status Code');

    if (records.length > 0) {
      templateContext['certEvents'] = {
        keys: certEventKeys,
        items: [],
      };
      for (const certRecord of records) {
        const newItem: any = {};
        const certEventRecord: QaCertEvent | QaCertEventGlobal | null =
          certRecord.qaCertEventIdentifier &&
          (await this.returnManager().findOneBy(QaCertEvent,
            { qaCertEventIdentifier: certRecord.qaCertEventIdentifier },
          ));

        if (certEventRecord) {
          newItem['System / Component Id'] =
            await this.getSystemComponentIdentifier(
              certEventRecord.monSystemIdentifier,
              certEventRecord.componentIdentifier,
            );
          newItem['Cert Event Code'] = certEventRecord.qaCertEventCode;
          newItem['Required Test Code'] = certEventRecord.requiredTestCode;
          if (certEventRecord instanceof QaCertEvent) {
            newItem['evalStatusCode'] = mappedStatusCodes.get(
              certEventRecord.evalStatusCode,
            );
            const colors = this.getReportColors(certEventRecord.evalStatusCode);
            newItem['reportColor'] = colors[0];
            newItem['reportLineColor'] = colors[1];
          }

          newItem['reportUrl'] = `${this.configService.get<string>(
            'app.ecmpsHost',
          )}/workspace/reports?reportCode=QCE_EVAL&facilityId=${orisCode}&qceId=${
            certEventRecord.qaCertEventIdentifier
          }`;

          templateContext['certEvents'].items.push(newItem);
        }
      }
    }
    return templateContext;
  }

  async formatTeeContext(
    templateContext: Record<string, any>,
    records: Array<Evaluation | SubmissionQueue>,
    orisCode: number | null,
    mappedStatusCodes: Map<string, string>,
  ) {
    const teeKeys = [
      'System / Component Id',
      'Year / Quarter',
      'Fuel Code',
      'Extension Exemption Code',
      'Hours Used',
      'Span Scale Code',
    ];

    teeKeys.push('Evaluation Status Code');

    if (records.length > 0) {
      templateContext['teeEvents'] = {
        keys: teeKeys,
        items: [],
      };

      for (const tee of records) {
        const newItem: any = {};
        const teeRecord: QaTee | QaTeeGlobal | null =
          tee.testExtensionExemptionIdentifier &&
          (await this.returnManager().findOneBy(QaTee,
            {
              testExtensionExemptionIdentifier:
                tee.testExtensionExemptionIdentifier,
            },
          ));
        const reportPeriodInfo =
          teeRecord &&
          (await this.returnManager().findOneBy(ReportingPeriod, {
            rptPeriodIdentifier: teeRecord.rptPeriodIdentifier,
          }));

        if (teeRecord) {
          newItem['System / Component Id'] =
            await this.getSystemComponentIdentifier(
              teeRecord.monSystemIdentifier,
              teeRecord.componentIdentifier,
            );
          newItem['Year / Quarter'] = reportPeriodInfo?.periodAbbreviation;
          newItem['Fuel Code'] = teeRecord.fuelCode;
          newItem['Extension Exemption Code'] = teeRecord.extensExemptCode;
          newItem['Hours Used'] = teeRecord.hoursUsed;
          newItem['Span Scale Code'] = teeRecord.spanScaleCode;
          if (teeRecord instanceof QaTee) {
            newItem['evalStatusCode'] = mappedStatusCodes.get(
              teeRecord.evalStatusCode,
            );
            const colors = this.getReportColors(teeRecord.evalStatusCode);
            newItem['reportColor'] = colors[0];
            newItem['reportLineColor'] = colors[1];
          }

          newItem['reportUrl'] = `${this.configService.get<string>(
            'app.ecmpsHost',
          )}/workspace/reports?reportCode=TEE_EVAL&facilityId=${orisCode}&teeId=${
            teeRecord.testExtensionExemptionIdentifier
          }`;

          templateContext['teeEvents'].items.push(newItem);
        }
      }
    }
    return templateContext;
  }

  async formatEmissionsContext(
    templateContext: Record<string, any>,
    records: Array<Evaluation | SubmissionQueue>,
    monitorPlanId: string,
    orisCode: number | null,
    mappedStatusCodes: Map<string, string>,
  ) {
    const emissionsKeys = ['Year / Quarter'];

    emissionsKeys.push('Evaluation Status Code');

    if (records.length > 0) {
      templateContext['emissions'] = {
        keys: emissionsKeys,
        items: [],
      };

      for (const em of records) {
        const newItem: any = {};
        const emissionsRecord: EmissionEvaluation | EmissionEvaluationGlobal =
          await this.returnManager().findOneBy(EmissionEvaluation,
            {
              monPlanIdentifier: monitorPlanId,
              rptPeriodIdentifier: em.rptPeriodIdentifier,
            },
          );

        if (emissionsRecord) {
          const reportPeriodInfo = await this.returnManager().findOneBy(
            ReportingPeriod,
            { rptPeriodIdentifier: emissionsRecord.rptPeriodIdentifier },
          );

          newItem['Year / Quarter'] = reportPeriodInfo.periodAbbreviation;
          if (emissionsRecord instanceof EmissionEvaluation) {
            newItem['evalStatusCode'] = mappedStatusCodes.get(
              emissionsRecord.evalStatusCode,
            );
            const colors = this.getReportColors(emissionsRecord.evalStatusCode);
            newItem['reportColor'] = colors[0];
            newItem['reportLineColor'] = colors[1];
          }

          newItem['reportUrl'] = `${this.configService.get<string>(
            'app.ecmpsHost',
          )}/workspace/reports?reportCode=EM_EVAL&facilityId=${orisCode}&monitorPlanId=${monitorPlanId}&year=${
            reportPeriodInfo.calendarYear
          }&quarter=${reportPeriodInfo.quarter}`;

          templateContext['emissions'].items.push(newItem);
        }
      }
    }
    return templateContext;
  }

  async formatMATSContext(
    templateContext: Record<string, any>,
    records: SubmissionQueue[],
  ) {
    const matsKeys = ['Test Type', 'Test Number', 'File Name'];

    if (records.length > 0) {
      templateContext['mats'] = {
        keys: matsKeys,
        items: [],
      };

      for (const matsRecord of records) {
        const newItem: any = {};
        const mats: MatsBulkFile =
          matsRecord.matsBulkFileId &&
          (await this.returnManager().findOneBy(MatsBulkFile, {
            id: matsRecord.matsBulkFileId,
          }));

        newItem['Test Type'] = mats?.testTypeGroupDescription;
        newItem['Test Number'] = mats?.testNumber;
        newItem['File Name'] = mats?.fileName;

        templateContext['mats'].items.push(newItem);
      }
    }
    return templateContext;
  }

  displayCurrentDate = () => {
    const date = new Date();

    return date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  };

  async sendEmailWithRetry(
    to: string,
    cc: string,
    from: string,
    subject: string,
    template: string,
    templateContext: any,
    attempt: number = 1,
    attachments: object[] = [],
  ) {
    if (attempt < 3) {
      this.mailerService
        .sendMail({
          to: to, // List of receivers email address
          cc: cc,
          from: from,
          subject: subject, // Subject line
          template: template,
          context: templateContext,
          attachments: attachments,
        })
        .then((success) => {
          console.log(success);
        })
        .catch(async (err) => {
          await new Promise((r) => setTimeout(r, attempt * 1000 * attempt));
          console.log('Attempting to send failed email request'); //
          this.sendEmailWithRetry(
            to,
            cc,
            from,
            subject,
            template,
            templateContext,
            attempt + 1,
            attachments
          );
        });
    } else {
      throw new EaseyException(
        new Error('Exceeded email attempt retry threshold'),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async buildEvalReports(
    set: EvaluationSet | SubmissionSet,
    records: Array<Evaluation | SubmissionQueue>,
    documents: object[],
  ) {
    //Handle QA
    const testSumRecords = records.filter(
      (r) => r.processCode === 'QA' && r.testSumIdentifier != null,
    );
    if (testSumRecords.length > 0) {
      const paramsTestSum = new ReportParamsDTO();
      paramsTestSum.facilityId = set.orisCode;

      let title = 'TEST_DETAIL_EVAL';
      paramsTestSum.reportCode = 'TEST_EVAL';
      paramsTestSum.testId = testSumRecords.map((tsr) => tsr.testSumIdentifier);

      const reportInformationTestSum = await this.dataSetService.getDataSet(
        paramsTestSum,
        true,
      );
      const evalStatusCodes = new Set(
        testSumRecords.map((tsr) => {
          if ('evalStatusCode' in tsr) {
            return tsr.evalStatusCode;
          }
        }),
      );

      documents.push({
        filename: `${set.orisCode}_${title}.html`,
        content: this.copyOfRecordService.generateCopyOfRecord(
          reportInformationTestSum,
          false,
          evalStatusCodes,
        ),
      });
    }

    const qaCertRecords = records.filter(
      (r) => r.processCode === 'QA' && r.qaCertEventIdentifier != null,
    );
    if (qaCertRecords.length > 0) {
      const paramsCert = new ReportParamsDTO();
      paramsCert.facilityId = set.orisCode;

      let title = 'QCE_EVAL';
      paramsCert.reportCode = 'QCE_EVAL';
      paramsCert.qceId = qaCertRecords.map((qce) => qce.qaCertEventIdentifier);

      const reportInformationQCE = await this.dataSetService.getDataSet(
        paramsCert,
        true,
      );

      const evalStatusCodes = new Set(
        qaCertRecords.map((qce) => {
          if ('evalStatusCode' in qce) {
            return qce.evalStatusCode;
          }
        }),
      );

      documents.push({
        filename: `${set.orisCode}_${title}.html`,
        content: this.copyOfRecordService.generateCopyOfRecord(
          reportInformationQCE,
          false,
          evalStatusCodes,
        ),
      });
    }

    const teeRecords = records.filter(
      (r) =>
        r.processCode === 'QA' && r.testExtensionExemptionIdentifier != null,
    );
    if (teeRecords.length > 0) {
      const paramsTee = new ReportParamsDTO();
      paramsTee.facilityId = set.orisCode;

      let title = 'TEE_EVAL';
      paramsTee.reportCode = 'TEE_EVAL';
      paramsTee.teeId = teeRecords.map(
        (tee) => tee.testExtensionExemptionIdentifier,
      );

      const reportInformationTEE = await this.dataSetService.getDataSet(
        paramsTee,
        true,
      );

      const evalStatusCodes = new Set(
        teeRecords.map((tee) => {
          if ('evalStatusCode' in tee) {
            return tee.evalStatusCode;
          }
        }),
      );

      documents.push({
        filename: `${set.orisCode}_${title}.html`,
        content: this.copyOfRecordService.generateCopyOfRecord(
          reportInformationTEE,
          false,
          evalStatusCodes,
        ),
      });
    }

    for (const rec of records) {
      if (rec.processCode !== 'QA') {
        const params = new ReportParamsDTO();
        params.facilityId = set.orisCode;

        let titleContext = '';
        const evalStatusCodes = new Set<string>();
        // Add Eval Report
        if (rec.processCode === 'MP') {
          if ('evalStatusCode' in rec) {
            evalStatusCodes.add(rec.evalStatusCode);
          }

          titleContext = 'MP_EVAL_' + set.monPlanIdentifier;
          params.reportCode = 'MP_EVAL';
          params.monitorPlanId = set.monPlanIdentifier;
        } else if (rec.processCode === 'EM') {
          if ('evalStatusCode' in rec) {
            evalStatusCodes.add(rec.evalStatusCode);
          }
          const rptPeriod: ReportingPeriod =
            rec.rptPeriodIdentifier &&
            (await this.returnManager().findOneBy(ReportingPeriod, {
              rptPeriodIdentifier: rec.rptPeriodIdentifier,
            }));

          params.reportCode = 'EM_EVAL';
          params.monitorPlanId = set.monPlanIdentifier;
          params.year = rptPeriod?.calendarYear;
          params.quarter = rptPeriod?.quarter;

          titleContext =
            'EM_EVAL_' +
            params.monitorPlanId +
            '_' +
            params.year +
            'q' +
            params.quarter;
        }

        const reportInformation = await this.dataSetService.getDataSet(
          params,
          true,
        );

        documents.push({
          filename: `${set.orisCode}_${titleContext}.html`,
          content: this.copyOfRecordService.generateCopyOfRecord(
            reportInformation,
            false,
            evalStatusCodes,
          ),
        });
      }
    }
  }

  async sendMassEvalEmail(
    to: string,
    cc: string,
    from: string,
    setId: string,
  ) {
    //Create our lookup map of eval codes to descriptions
    const statusCodes = await this.returnManager().query(
      'SELECT * FROM camdecmpsmd.eval_status_code',
    );
    const mappedStatusCodes = new Map<string, string>();
    statusCodes.forEach((cd) => {
      mappedStatusCodes.set(
        cd['eval_status_cd'],
        cd['eval_status_cd_description'],
      );
    });

    const mpKeys = [
      'Facility Name',
      'Configuration',
      'Oris Code',
      'State Code',
      'County',
    ];

    let subject;
    let template;
    let setRecord: SubmissionSet | EvaluationSet;
    let records: Array<SubmissionQueue | Evaluation>;

    let templateContext: any = {};
    const documents = [];

    subject = `ECMPS Evaluation Report | ${this.displayCurrentDate()}`;
    template = 'massEvaluationTemplate';
    records = await this.returnManager().find(Evaluation, {
      where: { evaluationSetIdentifier: setId },
    });
    setRecord = await this.returnManager().findOneBy(EvaluationSet, {
      evaluationSetIdentifier: setId,
    });

    await this.buildEvalReports(setRecord, records, documents);

    // Build the context for our email --------------------------------------
    templateContext['dateEvaluated'] = this.displayCurrentDate();
    templateContext['cdxUrl'] = this.configService.get<string>('app.cdxUrl');

    // Create Monitor Plan Section of Email
    const mpRecord: MonitorPlan | MonitorPlanGlobal =
      await this.returnManager().findOneBy( MonitorPlan,
        { monPlanIdentifier: setRecord.monPlanIdentifier },
      );
    const plant = await this.returnManager().findOneBy(Plant, {
      facIdentifier: mpRecord.facIdentifier,
    });
    const county =
      plant.countyCode &&
      (await this.returnManager().findOneBy(CountyCode, {
        countyCode: plant.countyCode,
      }));

    templateContext['monitorPlan'] = {
      keys: mpKeys,
      items: [
        {
          ['Facility Name']: setRecord.facName,
          ['Configuration']: setRecord.configuration,
          ['Oris Code']: plant.orisCode,
          ['State Code']: plant.state,
          ['County']: county?.countyName,
        },
      ],
    };

    const mpChildRecord = records.find((r) => r.processCode === 'MP');
    if (mpChildRecord) {
      if (mpRecord instanceof MonitorPlan) {
        templateContext['monitorPlan'].items['evalStatus'] =
          mappedStatusCodes.get(mpRecord.evalStatusCode);
        const colors = this.getReportColors(mpRecord.evalStatusCode);
        templateContext['monitorPlan'].items['reportColor'] = colors[0];
        templateContext['monitorPlan'].items['reportLineColor'] = colors[1];
      }

      templateContext['monitorPlan'].items[
        'reportUrl'
      ] = `${this.configService.get<string>(
        'app.ecmpsHost',
      )}/workspace/reports?reportCode=MP_EVAL&facilityId=${
        plant.orisCode
      }&monitorPlanId=${mpRecord.monPlanIdentifier}`;
    }

    //Create QA Section of Email ----------------------------------------
    const testDataChildRecords = records.filter(
      (r) => r.processCode === 'QA' && r.testSumIdentifier !== null,
    );
    templateContext = await this.formatTestDataContext(
      templateContext,
      testDataChildRecords,
      plant.orisCode,
      mappedStatusCodes,
    );

    const certChildRecords = records.filter(
      (r) => r.processCode === 'QA' && r.qaCertEventIdentifier !== null,
    );
    templateContext = await this.formatCertEventsContext(
      templateContext,
      certChildRecords,
      plant.orisCode,
      mappedStatusCodes,
    );

    const teeChildRecords = records.filter(
      (r) =>
        r.processCode === 'QA' && r.testExtensionExemptionIdentifier !== null,
    );
    templateContext = await this.formatTeeContext(
      templateContext,
      teeChildRecords,
      plant.orisCode,
      mappedStatusCodes,
    );

    //Create Emissions Section of Email
    const emissionsChildRecords = records.filter((r) => r.processCode === 'EM');
    templateContext = await this.formatEmissionsContext(
      templateContext,
      emissionsChildRecords,
      mpRecord.monPlanIdentifier,
      plant.orisCode,
      mappedStatusCodes,
    );

    this.sendEmailWithRetry(
      to,
      cc,
      from,
      subject,
      template,
      templateContext,
      1,
      documents,
    );
  }
}

import { Injectable } from '@nestjs/common';
import { getManager } from 'typeorm';
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

//Formats and sends emissions evaluations emails
@Injectable()
export class MailEvalService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  returnManager() {
    return getManager();
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
    const ms = await this.returnManager().findOne(MonitorSystem, monitorSystem);
    if (ms && ms.systemIdentifier) {
      return ms.systemIdentifier;
    }
    const c = await this.returnManager().findOne(Component, componentId);
    return c.componentIdentifier;
  }

  async formatTestDataContext(
    templateContext,
    records,
    orisCode,
    mappedStatusCodes,
  ) {
    const testDataKeys = [
      'System / Component Id',
      'Test Number',
      'Test Type',
      'Test Reason',
      'Test Result',
      'Evaluation Status Code',
    ];

    if (records.length > 0) {
      templateContext['testData'] = {
        keys: testDataKeys,
        items: [],
      };
      for (const testRecord of records) {
        const newItem: any = {};
        const testSumRecord: TestSummary = await this.returnManager().findOne(
          TestSummary,
          testRecord.testSumIdentifier,
        );

        newItem['System / Component Id'] =
          await this.getSystemComponentIdentifier(
            testSumRecord.monSystemIdentifier,
            testSumRecord.componentIdentifier,
          );
        newItem['Test Number'] = testSumRecord.testNumber;
        newItem['Test Type'] = testSumRecord.testTypeCode;
        newItem['Test Reason'] = testSumRecord.testReasonCode;
        newItem['Test Result'] = testSumRecord.testResultCode;
        newItem['evalStatusCode'] = mappedStatusCodes.get(
          testSumRecord.evalStatusCode,
        );
        const colors = this.getReportColors(testSumRecord.evalStatusCode);
        newItem['reportColor'] = colors[0];
        newItem['reportLineColor'] = colors[1];

        newItem['reportUrl'] = `${this.configService.get<string>(
          'app.ecmpsHost',
        )}/workspace/reports?reportCode=TEST_EVAL&facilityId=${orisCode}&testId=${
          testSumRecord.testSumIdentifier
        }`;

        templateContext['testData'].items.push(newItem);
      }
    }
    return templateContext;
  }

  async formatCertEventsContext(
    templateContext,
    records,
    orisCode,
    mappedStatusCodes,
  ) {
    const certEventKeys = [
      'System / Component Id',
      'Cert Event Code',
      'Required Test Code',
      'Evaluation Status Code',
    ];

    if (records.length > 0) {
      templateContext['certEvents'] = {
        keys: certEventKeys,
        items: [],
      };
      for (const certRecord of records) {
        const newItem: any = {};
        const certEventRecord: QaCertEvent = await this.returnManager().findOne(
          QaCertEvent,
          certRecord.qaCertEventIdentifier,
        );

        newItem['System / Component Id'] =
          await this.getSystemComponentIdentifier(
            certEventRecord.monSystemIdentifier,
            certEventRecord.componentIdentifier,
          );
        newItem['Cert Event Code'] = certEventRecord.qaCertEventCode;
        newItem['Required Test Code'] = certEventRecord.requiredTestCode;
        newItem['evalStatusCode'] = mappedStatusCodes.get(
          certEventRecord.evalStatusCode,
        );
        const colors = this.getReportColors(certEventRecord.evalStatusCode);
        newItem['reportColor'] = colors[0];
        newItem['reportLineColor'] = colors[1];

        newItem['reportUrl'] = `${this.configService.get<string>(
          'app.ecmpsHost',
        )}/workspace/reports?reportCode=QCE_EVAL&facilityId=${orisCode}&qceId=${
          certEventRecord.qaCertEventIdentifier
        }`;

        templateContext['certEvents'].items.push(newItem);
      }
    }
    return templateContext;
  }

  async formatTeeContext(
    templateContext,
    records,
    orisCode,
    mappedStatusCodes,
  ) {
    const teeKeys = [
      'System / Component Id',
      'Year / Quarter',
      'Fuel Code',
      'Extension Exemption Code',
      'Hours Used',
      'Span Scale Code',
      'Evaluation Status Code',
    ];

    if (records.length > 0) {
      templateContext['teeEvents'] = {
        keys: teeKeys,
        items: [],
      };

      for (const tee of records) {
        const newItem: any = {};
        const teeRecord: QaTee = await this.returnManager().findOne(
          QaTee,
          tee.testExtensionExemptionIdentifier,
        );
        const reportPeriodInfo = await this.returnManager().findOne(
          ReportingPeriod,
          teeRecord.rptPeriodIdentifier,
        );

        newItem['System / Component Id'] =
          await this.getSystemComponentIdentifier(
            teeRecord.monSystemIdentifier,
            teeRecord.componentIdentifier,
          );
        newItem['Year / Quarter'] = reportPeriodInfo.periodAbbreviation;
        newItem['Fuel Code'] = teeRecord.fuelCode;
        newItem['Extension Exemption Code'] = teeRecord.extensExemptCode;
        newItem['Hours Used'] = teeRecord.hoursUsed;
        newItem['Span Scale Code'] = teeRecord.spanScaleCode;
        newItem['evalStatusCode'] = mappedStatusCodes.get(
          teeRecord.evalStatusCode,
        );
        const colors = this.getReportColors(teeRecord.evalStatusCode);
        newItem['reportColor'] = colors[0];
        newItem['reportLineColor'] = colors[1];

        newItem['reportUrl'] = `${this.configService.get<string>(
          'app.ecmpsHost',
        )}/workspace/reports?reportCode=TEE_EVAL&facilityId=${orisCode}&teeId=${
          teeRecord.testExtensionExemptionIdentifier
        }`;

        templateContext['teeEvents'].items.push(newItem);
      }
    }
    return templateContext;
  }

  async formatEmissionsContext(
    templateContext,
    records,
    monitorPlanId,
    orisCode,
    mappedStatusCodes,
  ) {
    const emissionsKeys = ['Year / Quarter', 'Evaluation Status Code'];

    if (records.length > 0) {
      templateContext['emissions'] = {
        keys: emissionsKeys,
        items: [],
      };

      for (const em of records) {
        const newItem: any = {};
        const emissionsRecord: EmissionEvaluation =
          await this.returnManager().findOne(EmissionEvaluation, {
            where: {
              monPlanIdentifier: monitorPlanId,
              rptPeriodIdentifier: em.rptPeriodIdentifier,
            },
          });
        const reportPeriodInfo = await this.returnManager().findOne(
          ReportingPeriod,
          emissionsRecord.rptPeriodIdentifier,
        );

        newItem['Year / Quarter'] = reportPeriodInfo.periodAbbreviation;
        newItem['evalStatusCode'] = mappedStatusCodes.get(
          emissionsRecord.evalStatusCode,
        );
        const colors = this.getReportColors(emissionsRecord.evalStatusCode);
        newItem['reportColor'] = colors[0];
        newItem['reportLineColor'] = colors[1];

        newItem['reportUrl'] = `${this.configService.get<string>(
          'app.ecmpsHost',
        )}/workspace/reports?reportCode=EM_EVAL&facilityId=${orisCode}&monitorPlanId=${monitorPlanId}&year=${
          reportPeriodInfo.calendarYear
        }&quarter=${reportPeriodInfo.quarter}`;

        templateContext['emissions'].items.push(newItem);
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

  async sendMassEvalEmail(to: string, from: string, evalSetId: string) {
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
      'Longitude',
      'Latitude',
    ];

    const records = await this.returnManager().find(Evaluation, {
      where: { evaluationSetIdentifier: evalSetId },
    });

    // Build the context for our email --------------------------------------
    let templateContext: any = {};
    templateContext['dateEvaluated'] = this.displayCurrentDate();

    // Create Monitor Plan Section of Email
    const setRecord = await this.returnManager().findOne(
      EvaluationSet,
      evalSetId,
    );
    const mpRecord = await this.returnManager().findOne(
      MonitorPlan,
      setRecord.monPlanIdentifier,
    );
    const plant = await this.returnManager().findOne(
      Plant,
      mpRecord.facIdentifier,
    );
    const county = await this.returnManager().findOne(
      CountyCode,
      plant.countyCode,
    );

    templateContext['monitorPlan'] = {
      keys: mpKeys,
      items: [
        {
          ['Facility Name']: setRecord.facName,
          ['Configuration']: setRecord.configuration,
          ['Oris Code']: plant.orisCode,
          ['State Code']: plant.state,
          ['County']: county.countyName,
          ['Longitude']: plant.longitude,
          ['Latitude']: plant.latitude,
        },
      ],
    };

    const mpChildRecord = records.find((r) => r.processCode === 'MP');
    if (mpChildRecord) {
      const colors = this.getReportColors(mpRecord.evalStatusCode);
      templateContext['monitorPlan'].items['evalStatus'] =
        mappedStatusCodes.get(mpRecord.evalStatusCode);
      templateContext['monitorPlan'].items['reportColor'] = colors[0];
      templateContext['monitorPlan'].items['reportLineColor'] = colors[1];

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

    this.mailerService
      .sendMail({
        to: to, // List of receivers email address
        from: from,
        subject: `ECMPS Evaluation Report | ${this.displayCurrentDate()}`, // Subject line
        template: 'massEvaluationTemplate',
        context: templateContext,
      })
      .then((success) => {
        console.log(success);
      })
      .catch((err) => {
        console.log(err);
      });
  }
}

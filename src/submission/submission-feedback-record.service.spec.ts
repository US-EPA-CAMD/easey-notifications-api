import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { LoggerModule } from '@us-epa-camd/easey-common/logger';
import { DataSetService } from '../dataset/dataset.service';
import { ReportDTO } from '../dto/report.dto';
import { ReportColumnDTO } from '../dto/report-column.dto';
import { ReportDetailDTO } from '../dto/report-detail.dto';
import { SubmissionFeedbackRecordService } from './submission-feedback-record.service';

describe('-- Submission Feedback Record Service --', () => {
  let service: SubmissionFeedbackRecordService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        SubmissionFeedbackRecordService,
        EntityManager,
        {
          provide: DataSetService,
          useFactory: () => ({
            getDataSet: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get(SubmissionFeedbackRecordService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate summary table for unit stack', () => {
    const reportDTO = new ReportDTO();
    reportDTO.details = [
      {
        templateCode: 'templateCode1',
        templateType: 'templateType1',
        results: [{ column1: 'value1', column2: 'value2' }],
      },
    ] as ReportDetailDTO[];
    reportDTO.columns = [
      {
        code: 'templateCode1',
        values: [
          { name: 'column1', displayName: 'Column 1' },
          { name: 'column2', displayName: 'Column 2' },
        ],
      },
    ] as ReportColumnDTO[];

    const result = service.generateSummaryTableForUnitStack(reportDTO, 'USP001');
    expect(result).toContain('Unit/Stack/Pipe ID: USP001');
    expect(result).toContain('<th>Column 1</th>');
    expect(result).toContain('<th>Column 2</th>');
    expect(result).toContain('<td>value1</td>');
    expect(result).toContain('<td>value2</td>');

  });

  it('should add default table', () => {
    const columns = {
      values: [
        { name: 'column1', displayName: 'Column 1' },
        { name: 'column2', displayName: 'Column 2' },
      ],
    } as ReportColumnDTO;
    const detail = {
      results: [{ column1: 'value1', column2: 'value2' }],
    } as ReportDetailDTO;

    const result = service.addTable(columns, detail, 'Unit/Stack/Pipe ID: USP001');
    expect(result).toContain('Unit/Stack/Pipe ID: USP001');
    expect(result).toContain('<th>Column 1</th>');
    expect(result).toContain('<th>Column 2</th>');
    expect(result).toContain('<td>value1</td>');
    expect(result).toContain('<td>value2</td>');
  });
});

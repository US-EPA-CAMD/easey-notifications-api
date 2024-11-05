import { Template } from './../entities/template.entity';
import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { DataSetRepository } from './dataset.repository';
import { DataSetService } from './dataset.service';
import { DataSet } from '../entities/dataset.entity';
import { DataTable } from '../entities/datatable.entity';
import { DataColumn } from '../entities/datacolumn.entity';
import { DataParameter } from '../entities/dataparameter.entity';

const mockRepository = () => ({
  getDataSet: jest.fn(),
  query: jest.fn(),
});

const dataset = new DataSet();
dataset.code = 'TEST';
dataset.displayName = 'Test';
dataset.groupCode = 'TEST';
const dataTable = new DataTable();
dataTable.dataSetCode = 'TEST';
dataTable.displayName = 'Test';
dataTable.sqlStatement = 'SELECT * FROM SCHEMA.TABLE';
dataTable.template = new Template();
dataTable.template.code = 'TEST';
dataTable.template.type = 'TEST';
dataTable.template.groupCode = 'TEST';
dataTable.template.displayName = 'Test';
const dataColumn = new DataColumn();
dataColumn.name = 'column_one';
dataColumn.alias = 'columnOne';
dataColumn.displayName = 'Column One';
const dataParam = new DataParameter();
dataParam.name = 'column_one';
dataTable.columns = [];
dataTable.columns.push(dataColumn);
dataTable.parameters = [];
dataTable.parameters.push(dataParam);
dataset.tables = [];
dataset.tables.push(dataTable);

describe('DataSetService', () => {
  let repository: any;
  let service: DataSetService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DataSetService,
        EntityManager,
        {
          provide: DataSetRepository,
          useFactory: mockRepository,
        },
      ],
    }).compile();

    service = module.get(DataSetService);
    repository = module.get(DataSetRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(repository).toBeDefined();
  });

  // describe('getDataSet', () => {
  //   it('should return a dataset', async () => {
  //     const params = new ReportParamsDTO();
  //     repository.getDataSet.mockResolvedValue(dataset);
  //     repository.query.mockResolvedValue([]);
  //     const result = await service.getDataSet(params);

  //     expect(repository.getDataSet).toHaveBeenCalled();
  //     expect(repository.query).toHaveBeenCalled();
  //     expect(result).toEqual({"columns": [], "details": [], "displayName": "Test"});
  //   });

  // });
});

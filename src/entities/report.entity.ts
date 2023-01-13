import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryColumn
} from 'typeorm';

import { ReportDetail } from './report-detail.entity';

@Entity({ name: 'camdaux.dataset' })
export class Report extends BaseEntity {
  @PrimaryColumn({
    name: 'dataset_cd',
  })
  code: string;

  @Column({
    name: 'group_cd',
  })
  groupCode: string;

  @Column({
    name: 'display_name',
  })
  displayName: string;

  @Column({
    name: 'no_results_msg',
  })
  noResultsMessage: string;

  @OneToMany(
    () => ReportDetail,
    o => o.report,
  )
  @JoinColumn({ name: 'dataset_cd' })
  details: ReportDetail[];
}

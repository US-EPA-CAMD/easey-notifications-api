import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CreateMailDto } from '../dto/create-mail.dto';
import { Logger } from '@us-epa-camd/easey-common/logger';
import { ClientConfig } from '../entities/client-config.entity';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly logger: Logger,
    private readonly mailerService: MailerService,
  ) {}

  returnManager() {
    return this.entityManager;
  }

  async sendEmail(clientId: string, payload: CreateMailDto): Promise<void> {
    const dbRecord = await this.returnManager().findOneBy<ClientConfig>(
      ClientConfig,
      { id: clientId },
    );

    this.mailerService
      .sendMail({
        from: payload.fromEmail,
        to: dbRecord.supportEmail, // List of receivers email address
        subject: payload.subject, // Subject line
        text: payload.message,
      })
      .then((success) => {
        console.log(success);
      })
      .catch((err) => {
        console.log(err);
      });
  }
}

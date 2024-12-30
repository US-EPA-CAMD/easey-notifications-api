import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { EmailToSend } from '../entities/email-to-send.entity';
import { EmailTemplate } from '../entities/email-template.entity';
import { EaseyException } from '@us-epa-camd/easey-common/exceptions';

//Sends and formats html templates based on the content-url
@Injectable()
export class MailTemplateService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  returnManager() {
    return this.entityManager;
  }

  async getAndFormatTemplate(templateUrl, context): Promise<string> {
    let templateString;
    const contentUri = this.configService.get<string>('app.contentUri');
    try {
      const url = `${contentUri}/${templateUrl}`;
      const template = await firstValueFrom(this.httpService.get(url));
      templateString = template.data;
    } catch (e) {
      throw new EaseyException(e, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    for (const key in context) {
      if (Object.prototype.hasOwnProperty.call(context, key)) {
        const regex = new RegExp(`\\[\\[${key}\\]\\]`, 'g');

        let formattedValue;

        if (typeof context[key] === 'object') {
          formattedValue = context[key].join(', ');
        } else {
          formattedValue = context[key];
        }

        templateString = templateString.replace(regex, formattedValue);
      }
    }

    return templateString;
  }

  async sendTemplateEmail(
    to: string,
    from: string,
    subject: string,
    templateLocation: string,
    context: object,
  ) {
    const formattedTemplate = await this.getAndFormatTemplate(
      templateLocation,
      context,
    );
    this.mailerService
      .sendMail({
        from: from,
        to: to, // List of receivers email address
        subject: subject, // Subject line
        html: formattedTemplate, // HTML body content
      })
      .then((success) => {
        console.log(success);
      })
      .catch((err) => {
        console.log(err);
      });
  }

  async sendEmailRecord(queueId: number): Promise<void> {
    try {
      const record = await this.entityManager.findOneBy(EmailToSend, {
        toSendIdentifier: queueId,
      });
      if (record) {
        //Call into the template email service
        const template =
          record.templateIdentifier &&
          (await this.entityManager.findOneBy(EmailTemplate, {
            templateIdentifier: record.templateIdentifier,
          }));

        let context; //Extract context
        if (record.context) {
          context = JSON.parse(record.context);
        } else {
          context = {};
        }

        await this.sendTemplateEmail(
          record.toEmail,
          record.fromEmail,
          template.templateSubject,
          template.templateLocation,
          context,
        );

        record.statusCode = 'COMPLETE';
        await this.entityManager.save(record);
      }
    } catch (e) {
      throw new EaseyException(e, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SubmissionTemplateService {
  private templatesCache: Map<string, Handlebars.TemplateDelegate> = new Map();

  constructor() {
    this.registerPartials();
    this.registerHelpers();
  }

  private registerPartials() {
    const partialsDir = path.join(__dirname, 'templates', 'partials');
    const filenames = fs.readdirSync(partialsDir);

    filenames.forEach((filename) => {
      const matches = /^([^.]+).hbs$/.exec(filename);
      if (!matches) {
        return;
      }
      const name = matches[1];
      const filepath = path.join(partialsDir, filename);
      const template = fs.readFileSync(filepath, 'utf8');

      Handlebars.registerPartial(name, template);
    });
  }

  private registerHelpers() {
    Handlebars.registerHelper('eq', function (arg1, arg2) {
      return arg1 === arg2;
    });

    Handlebars.registerHelper('not_eq', function (arg1, arg2) {
      return arg1 !== arg2;
    });

    Handlebars.registerHelper('and', function () {
      return Array.prototype.every.call(arguments, Boolean);
    });

    Handlebars.registerHelper('or', function () {
      return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    });

    // Register isObject helper
    Handlebars.registerHelper('isObject', function (value) {
      return typeof value === 'object' && value !== null;
    });
  }

  async renderTemplate(templateName: string, context: any): Promise<string> {
    let template = this.templatesCache.get(templateName);

    if (!template) {
      const templatePath = path.join(__dirname, 'templates', templateName);
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      template = Handlebars.compile(templateSource);
      this.templatesCache.set(templateName, template);
    }

    return template(context);
  }
}

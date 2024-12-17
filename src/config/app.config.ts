import { registerAs } from '@nestjs/config';
import {
  getConfigValue,
  getConfigValueNumber,
  getConfigValueBoolean,
} from '@us-epa-camd/easey-common/utilities';

require('dotenv').config();

const host = getConfigValue('EASEY_CAMD_SERVICES_HOST', 'localhost');
const port = getConfigValueNumber('EASEY_CAMD_SERVICES_PORT', 8060);
const path = getConfigValue('EASEY_CAMD_SERVICES_PATH', 'camd-services');

let uri = `https://${host}/${path}`;

if (host == 'localhost') {
  uri = `http://localhost:${port}/${path}`;
}

const apiHost = getConfigValue(
  'EASEY_API_GATEWAY_HOST',
  'api.epa.gov/easey/dev',
);

export const smtpHost = getConfigValue(
  'EASEY_CAMD_SERVICES_SMTP_HOST',
  'smtp.epa.gov',
);

export const smtpPort = getConfigValueNumber(
  'EASEY_CAMD_SERVICES_SMTP_PORT',
  25,
);

export default registerAs('app', () => ({
  name: 'camd-services',
  host,
  port,
  path,
  uri,
  title: getConfigValue(
    'EASEY_CAMD_SERVICES_TITLE',
    'CAMD Administrative & General Services',
  ),
  description: getConfigValue(
    'EASEY_CAMD_SERVICES_DESCRIPTION',
    'Provides administrative & general services for CAMD applications.',
  ),
  env: getConfigValue('EASEY_CAMD_SERVICES_ENV', 'local-dev'),
  apiKey: getConfigValue('EASEY_CAMD_SERVICES_API_KEY'),
  enableApiKey: getConfigValueBoolean('EASEY_CAMD_SERVICES_ENABLE_API_KEY'),
  clientId: getConfigValue("EASEY_CAMD_SERVICES_CLIENT_ID"),
  clientSecret: getConfigValue("EASEY_CAMD_SERVICES_CLIENT_SECRET"),
  enableClientToken: getConfigValueBoolean(
    'EASEY_CAMD_SERVICES_ENABLE_CLIENT_TOKEN',
  ),
  enableRoleGuard: getConfigValueBoolean(
    'EASEY_CAMD_SERVICES_ENABLE_ROLE_GUARD',
    true,
  ),
  defaultFromEmail: getConfigValue(
    'EASEY_CAMD_SERVICES_DEFAULT_FROM_EMAIL',
    'ecmps@epa.gov',
  ),
  cdxUrl: getConfigValue(
    'EASEY_CAMD_SERVICES_CDX_URL',
    'https://dev.epacdx.net/',
  ),
  epaAnalystLink: getConfigValue(
    'EASEY_CAMD_SERVICES_EPA_ANALYST_LINK',
    'https://www.epa.gov/power-sector/business-center-and-emissions-monitoring-contacts#MonitoringContacts',
  ),
  enableAuthToken: getConfigValueBoolean(
    'EASEY_CAMD_SERVICES_ENABLE_AUTH_TOKEN',
    true,
  ),
  secretToken: getConfigValue('EASEY_CAMD_SERVICES_SECRET_TOKEN'),
  enableSecretToken: getConfigValueBoolean(
    'EASEY_CAMD_SERVICES_ENABLE_SECRET_TOKEN',
  ),
  enableCors: getConfigValueBoolean('EASEY_CAMD_SERVICES_ENABLE_CORS', true),
  enableGlobalValidationPipes: getConfigValueBoolean(
    'EASEY_CAMD_SERVICES_ENABLE_GLOBAL_VALIDATION_PIPE',
    true,
  ),
  enableRoleGuardCheckoutCheck: getConfigValueBoolean(
    'EASEY_CAMD_SERVICES_ENABLE_ROLE_GUARD_CHECKOUT',
    true,
  ),
  ecmpsHost: getConfigValue('EASEY_CAMD_SERVICES_ECMPS_HOST'),
  version: getConfigValue('EASEY_CAMD_SERVICES_VERSION', 'v0.0.0'),
  published: getConfigValue('EASEY_CAMD_SERVICES_PUBLISHED', 'local'),
  maxMatsUploadSizeMB: getConfigValueNumber(
    'EASEY_CAMD_SERVICES_MAX_MATS_UPLOAD_SIZE',
    100,
  ),
  // ENABLES DEBUG CONSOLE LOGS
  enableDebug: getConfigValueBoolean('EASEY_CAMD_SERVICES_ENABLE_DEBUG'),
  sqlLogging: getConfigValueBoolean('EASEY_DB_SQL_LOGGING',false),
  /**
   * Needs to be set in .env file for local development if `EASEY_EMISSIONS_API_ENABLE_AUTH_TOKEN` is false.
   * Format:
   *   {
   *       "facilities": [
   *           { "facId": number, "orisCode": number, "permissions": string[] }
   *       ],
   *       "roles": <"Preparer" | "Submitter" | "Sponsor">[],
   *       "userId": string
   *   }
   */
  currentUser: getConfigValue(
    'EASEY_CAMD_SERVICES_CURRENT_USER',
    '{"userId": ""}',
  ),
  contentUri: getConfigValue(
    'EASEY_CAMD_SERVICES_CONTENT_API',
    'https://api.epa.gov/easey/dev/content-mgmt',
  ),
  apiHost: apiHost,
  authApi: {
    uri: getConfigValue('EASEY_AUTH_API', `https://${apiHost}/auth-mgmt`),
  },
  streamingApiUrl: getConfigValue(
    'EASEY_STREAMING_SERVICES',
    `https://${apiHost}/streaming-services`,
  ),
  submissionSuccessMessage: getConfigValue(
    'EASEY_CAMD_SERVICES_SUBMISSION_SUCCESS_MESSAGE',
    '',
  ),
  submissionCritMessage: getConfigValue(
    'EASEY_CAMD_SERVICES_SUBMISSION_CRIT_MESSAGE',
    '',
  ),
  recipientsListApi: getConfigValue('EASEY_CAMD_SERVICES_RECIPIENT_LIST_API', 'https://cbsstagei.epa.gov/CBSD'),
  recipientsListApiEnabled: getConfigValueBoolean('EASEY_CAMD_SERVICES_RECIPIENT_LIST_API_ENABLED',true),
}));

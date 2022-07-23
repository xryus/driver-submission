const core = require('@actions/core');
const github = require('@actions/github');

const axiosRetry = require('axios-retry');
const axios = require('axios');

axiosRetry(axios, { retries: 10, retryDelay: 5000 });

const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const TENANT_ID = core.getInput('tenant-id');
const CLIENT_ID = core.getInput('client-id');
const CLIENT_SECRET = core.getInput('client-secret');
const PRODUCT_NAME = core.getInput('product-name');
const SIGNATURES = core.getInput('signatures');
const BIN_PATH_IN = core.getInput('bin-path-in');
const BIN_PATH_OUT = core.getInput('bin-path-out');
const USE_OUTPUT = !!BIN_PATH_OUT;

const ERRORS = {
  INVALID_CREDENTIALS: 'An invalid credentials specified',
  SUBMISSION_FAILED: 'A submission failed',
  SUBMISSION_COMMIT_FAILED: 'A submission commit failed',
  SUBMISSION_QUERY_FAILED: 'A submission query failed',
  SUBMISSION_UPLOAD_FAILED: 'A submission file upload failed',
  SUBMISSION_CREATE_FAILED: 'A submission creation failed',
  SUBMISSION_PRODUCT_CREATE_FAILED: 'A submission product creation failed',
};

const Session = class {
  constructor(tenantId, clientId, clientSecret) {
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async init() {
    var payload = new URLSearchParams();
    payload.append('grant_type', 'client_credentials');
    payload.append('client_id', this.clientId);
    payload.append('client_secret', this.clientSecret);
    payload.append('resource', 'https://manage.devcenter.microsoft.com');

    let client = axios.create({
      baseURL: `https://login.microsoftonline.com/${this.tenantId}/oauth2/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      responseType: 'json',
    });

    axiosRetry(client, { retries: 10, retryDelay: 5000 });

    await client
      .post('/', payload)
      .then((res) => {
        this.tokenType = res.data.token_type;
        this.token = res.data.access_token;
        this.auth = `${this.tokenType} ${this.token}`;

        core.debug('authentication succeeded');
      })
      .catch((err) => {
        core.setFailed(`${ERRORS.INVALID_CREDENTIALS}: ${err}`);
      });
  }

  async newProduct(productName) {
    var payload = {
      productName: productName,
      testHarness: 'attestation',
      deviceMetadataIds: [],
      deviceType: 'internalExternal',
      isTestSign: false,
      isFlightSign: false,
      marketingNames: [],
      selectedProductTypes: {},
      requestedSignatures: JSON.parse(SIGNATURES),
      additionalAttributes: {},
    };

    let client = axios.create({
      baseURL: `https://manage.devcenter.microsoft.com/v2.0/my/hardware/products/`,
      headers: {
        Authorization: this.auth,
      },
      responseType: 'json',
    });

    axiosRetry(client, { retries: 10, retryDelay: 5000 });

    await client
      .post('/', payload)
      .then((res) => {
        this.product = res.data;
      })
      .catch((err) => {
        core.setFailed(`${ERRORS.SUBMISSION_PRODUCT_CREATE_FAILED}: ${err}`);
      });
  }

  async newSubmission(productId, productName, productType = 'initial') {
    var payload = {
      name: productName,
      type: productType,
    };

    let client = axios.create({
      baseURL: `https://manage.devcenter.microsoft.com/v2.0/my/hardware/products/${productId}/submissions`,
      headers: {
        Authorization: this.auth,
      },
      responseType: 'json',
    });

    axiosRetry(client, { retries: 10, retryDelay: 5000 });

    await client
      .post('/', payload)
      .then((res) => {
        this.submission = res.data;
      })
      .catch((err) => {
        core.setFailed(`${ERRORS.SUBMISSION_CREATE_FAILED}: ${err}`);
      });

    return true;
  }

  async uploadFile(url, path) {
    const binary = await require('fs/promises').readFile(path);

    var res = await axios({
      method: 'PUT',
      url: url,
      headers: { 'x-ms-blob-type': 'BlockBlob' },
      data: binary,
    });

    if (res.status != 201) {
      throw `${ERRORS.SUBMISSION_UPLOAD_FAILED}`;
    }

    return true;
  }

  async commitSubmission(productId, submissionId) {
    let client = axios.create({
      baseURL: `https://manage.devcenter.microsoft.com/v2.0/my/hardware/products/${productId}/submissions/${submissionId}/commit`,
      headers: {
        Authorization: this.auth,
        'Content-Type': 'application/json',
        'Content-Length': '0',
      },
    });

    axiosRetry(client, { retries: 10, retryDelay: 5000 });

    client
      .post(`/`)
      .then((res) => {})
      .catch((err) => {
        core.setFailed(`${ERRORS.SUBMISSION_COMMIT_FAILED}: ${err}`);
      });

    return true;
  }

  async querySubmission(productId, submissionId) {
    let client = axios.create({
      baseURL: `https://manage.devcenter.microsoft.com/v2.0/my/hardware/products/${productId}/submissions/${submissionId}`,
      headers: {
        Authorization: this.auth,
        'Content-Type': 'application/json',
        'Content-Length': '0',
      },
    });

    axiosRetry(client, { retries: 10, retryDelay: 5000 });

    client
      .get(`/`)
      .then((res) => {
        this.status = res.data;
      })
      .catch((err) => {
        core.setFailed(`${ERRORS.SUBMISSION_QUERY_FAILED}: ${err}`);
      });

    return true;
  }
};

async function downloadFileFromUrl(url, file) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(file, new Buffer.from(res.data), 'binary');
}

async function main() {
  var session = new Session(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
  await session.init();

  core.info('create new product...');
  await session.newProduct(PRODUCT_NAME);
  var productIdStr = session.product['links'][0]['href']
    .split('/')
    .slice(-1)[0];
  core.info(`created product id: ${productIdStr}`);

  core.info('create new submission...');
  await session.newSubmission(productIdStr, PRODUCT_NAME);
  var submissionIdStr = session.submission['links'][0]['href']
    .split('/')
    .slice(-1)[0];
  core.info(`created submission id: ${submissionIdStr}`);

  var uploadUrl = session.submission['downloads']['items'][0]['url'];
  core.info(`upload url: ${uploadUrl}`);

  core.info(`upload to blob...`);
  var uploaded = await session.uploadFile(uploadUrl, BIN_PATH_IN);
  core.info(`the file has been uploaded to blob (${uploaded})`);

  //
  // Commit the submission, however, the commission
  // may fail with low possibility, so retry N times.
  //
  core.info(`commit submission...`);
  var commit_retry_count = 0;
  while (true) {
    try {
      var commited = await session.commitSubmission(
        productIdStr,
        submissionIdStr
      );
      if (commited) break;
    } catch (err) {
      core.debug(`${ERRORS.SUBMISSION_COMMIT_FAILED}: ${err}`);
      if (commit_retry_count < 10) {
        commit_retry_count += 1;
        continue;
      } else {
        throw `${ERRORS.SUBMISSION_COMMIT_FAILED}`;
      }
    }
  }

  core.info(`submission has been committed`);
  core.info(`wait for the submission to complete`);

  var previousStep = '';
  while (true) {
    //
    // Refresh session every time.
    // Othwerwise, the status will show same as previous. (weird)
    //
    session = new Session(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    await session.init();

    await session.querySubmission(productIdStr, submissionIdStr);
    var step = session.status['workflowStatus']['currentStep'];
    var state = session.status['workflowStatus']['state'];

    if (previousStep) {
      if (previousStep != step) {
        core.info(`step has been changed to: ${step}`);
        previousStep = step;
      }
    } else {
      core.info(`current step: ${step}`);
      previousStep = step;
    }
    if (state == 'completed') {
      core.info(`the submission has been completed successfully`);

      //
      // Only download the signed package
      // if output file path is specified.
      //
      if (USE_OUTPUT) {
        var foundSignedPackage = false;
        while (!foundSignedPackage) {
          var items = session.status['downloads']['items'];
          for (var index = 0; index < items.length; index++) {
            var v = items[index];
            if (v['type'] == 'signedPackage') {
              core.info(`signed package download url: ${v['url']}`);
              var zipFileName = path.join(BIN_PATH_OUT, `signed.zip`);
              await downloadFileFromUrl(v['url'], zipFileName);
              foundSignedPackage = true;
              break;
            }
          }
          if (foundSignedPackage) break;
          session = new Session(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
          await session.init();
          await session.querySubmission(productIdStr, submissionIdStr);
          await sleep(5000);
        }
      }

      break;
    } else if (state == 'failed') {
      throw `${ERRORS.SUBMISSION_FAILED}`;
    }
    await sleep(5000);
  }

  core.info('done');
}

main();

const core = require('@actions/core');
const github = require('@actions/github');

const TENANT_ID = core.getInput('tenant-id');
const CLIENT_ID = core.getInput('client-id');
const CLIENT_SECRET = core.getInput('client-secret');
const PRODUCT_NAME = core.getInput('product-name');
const BIN_PATH_IN = core.getInput('bin-path-in');
const BIN_PATH_OUT = core.getInput('bin-path-out');
const USE_OUTPUT = !!BIN_PATH_OUT

const ERRORS = {
    INVALID_CREDENTIALS: 'An invalid credentials specified',
    SUBMISSION_FAILED: 'A submission failed',
    SUBMISSION_COMMIT_FAILED: 'A submission commit failed',
    SUBMISSION_QUERY_FAILED: 'A submission query failed',
    SUBMISSION_UPLOAD_FAILED: 'A submission file upload failed',
    SUBMISSION_CREATE_FAILED: 'A submission creation failed',
    SUBMISSION_PRODUCT_CREATE_FAILED: 'A submission product creation failed',
}

const Session = class {
    constructor(tenantId, clientId, clientSecret) {
        this.#tenantId = tenantId
        this.#clientId = clientId
        this.#clientSecret = clientSecret
    }

    async init() {
        var payload = new URLSearchParams();
        payload.append('grant_type', 'client_credentials');
        payload.append('client_id', this.#clientId);
        payload.append('client_secret', this.#clientSecret);
        payload.append('resource', 'https://manage.devcenter.microsoft.com');

        await require('axios').create({
            baseURL: `https://login.microsoftonline.com/${this.#tenantId
                }/oauth2/token`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            responseType: 'json'
        })
            .post('/', payload)
            .then((res) => {
                this.#tokenType = res.token_type
                this.#token = res.access_token
                this.#auth = `${this.#tokenType} ${this.#token}`

                this.#axios = require('axios').create({
                    baseURL: 'https://manage.devcenter.microsoft.com',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': this.#auth,
                    },
                    responseType: 'json'
                });

                core.debug('authentication succeeded')
            })
            .catch((err) => {
                core.setFailed(`${ERRORS.INVALID_CREDENTIALS}}: ${err}`);
            })
    }

    async newProduct(productName) {
        payload = {
            productName: productName,
            testHarness: 'attestation',
            deviceMetadataIds: [],
            firmwareVersion: '980',
            deviceType: 'internalExternal',
            isTestSign: false,
            isFlightSign: false,
            marketingNames: [],
            selectedProductTypes: {},
            requestedSignatures: [
                'WINDOWS_v100_TH2_FULL',
                'WINDOWS_v100_X64_TH2_FULL',
                'WINDOWS_v100_RS1_FULL',
                'WINDOWS_v100_X64_RS1_FULL',
                'WINDOWS_v100_RS2_FULL',
                'WINDOWS_v100_X64_RS2_FULL',
                'WINDOWS_v100_RS3_FULL',
                'WINDOWS_v100_X64_RS3_FULL',
                'WINDOWS_v100_ARM64_RS3_FULL',
                'WINDOWS_v100_RS4_FULL',
                'WINDOWS_v100_X64_RS4_FULL',
                'WINDOWS_v100_ARM64_RS4_FULL',
                'WINDOWS_v100_RS5_FULL',
                'WINDOWS_v100_X64_RS5_FULL',
                'WINDOWS_v100_ARM64_RS5_FULL',
                'WINDOWS_v100_19H1_FULL',
                'WINDOWS_v100_X64_19H1_FULL',
                'WINDOWS_v100_ARM64_19H1_FULL',
                'WINDOWS_v100_VB_FULL',
                'WINDOWS_v100_X64_VB_FULL',
                'WINDOWS_v100_ARM64_VB_FULL',
                'WINDOWS_v100_X64_CO_FULL',
                'WINDOWS_v100_ARM64_CO_FULL',
            ],
            additionalAttributes: {}
        }
    }

    async newSubmission(name, type) {
        payload = {
            name: name,
            type: type
        }
    }
}
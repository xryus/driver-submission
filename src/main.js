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
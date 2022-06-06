const axios = require("axios");
const fs = require("fs");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const TENANT_ID = process.argv[2];
const CLIENT_ID = process.argv[3];
const CLIENT_SECRET = process.argv[4];
const PRODUCT_NAME = process.argv[5];
const BIN_PATH_IN = process.argv[6];
const BIN_PATH_OUT = process.argv[7];
const USE_OUTPUT = !!BIN_PATH_OUT;

const ERRORS = {
  INVALID_CREDENTIALS: "An invalid credentials specified",
  SUBMISSION_FAILED: "A submission failed",
  SUBMISSION_COMMIT_FAILED: "A submission commit failed",
  SUBMISSION_QUERY_FAILED: "A submission query failed",
  SUBMISSION_UPLOAD_FAILED: "A submission file upload failed",
  SUBMISSION_CREATE_FAILED: "A submission creation failed",
  SUBMISSION_PRODUCT_CREATE_FAILED: "A submission product creation failed",
};

const Session = class {
  constructor(tenantId, clientId, clientSecret) {
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async init() {
    var payload = new URLSearchParams();
    payload.append("grant_type", "client_credentials");
    payload.append("client_id", this.clientId);
    payload.append("client_secret", this.clientSecret);
    payload.append("resource", "https://manage.devcenter.microsoft.com");

    await axios
      .create({
        baseURL: `https://login.microsoftonline.com/${this.tenantId}/oauth2/token`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        responseType: "json",
      })
      .post("/", payload)
      .then((res) => {
        this.tokenType = res.data.token_type;
        this.token = res.data.access_token;
        this.auth = `${this.tokenType} ${this.token}`;

        //core.debug('authentication succeeded')
        //console.log("authentication succeeded");
      })
      .catch((err) => {
        console.log(err);
        //core.setFailed(`${ERRORS.INVALID_CREDENTIALS}}: ${err}`);
      });
  }

  async newProduct(productName) {
    var payload = {
      productName: productName,
      testHarness: "attestation",
      deviceMetadataIds: [],
      firmwareVersion: "980",
      deviceType: "internalExternal",
      isTestSign: false,
      isFlightSign: false,
      marketingNames: [],
      selectedProductTypes: {},
      requestedSignatures: [
        "WINDOWS_v100_TH2_FULL",
        "WINDOWS_v100_X64_TH2_FULL",
        "WINDOWS_v100_RS1_FULL",
        "WINDOWS_v100_X64_RS1_FULL",
        "WINDOWS_v100_RS2_FULL",
        "WINDOWS_v100_X64_RS2_FULL",
        "WINDOWS_v100_RS3_FULL",
        "WINDOWS_v100_X64_RS3_FULL",
        "WINDOWS_v100_ARM64_RS3_FULL",
        "WINDOWS_v100_RS4_FULL",
        "WINDOWS_v100_X64_RS4_FULL",
        "WINDOWS_v100_ARM64_RS4_FULL",
        "WINDOWS_v100_RS5_FULL",
        "WINDOWS_v100_X64_RS5_FULL",
        "WINDOWS_v100_ARM64_RS5_FULL",
        "WINDOWS_v100_19H1_FULL",
        "WINDOWS_v100_X64_19H1_FULL",
        "WINDOWS_v100_ARM64_19H1_FULL",
        "WINDOWS_v100_VB_FULL",
        "WINDOWS_v100_X64_VB_FULL",
        "WINDOWS_v100_ARM64_VB_FULL",
        "WINDOWS_v100_X64_CO_FULL",
        "WINDOWS_v100_ARM64_CO_FULL",
      ],
      additionalAttributes: {},
    };

    await axios
      .create({
        baseURL: `https://manage.devcenter.microsoft.com/v2.0/my/hardware/products/`,
        headers: {
          Authorization: this.auth,
        },
        responseType: "json",
      })
      .post("/", payload)
      .then((res) => {
        this.product = res.data;
      })
      .catch((err) => {
        console.log(err);
        //core.setFailed(`${ERRORS.INVALID_CREDENTIALS}}: ${err}`);
      });
  }

  async newSubmission(productId, productName, productType = "initial") {
    var payload = {
      name: productName,
      type: productType,
    };

    await axios
      .create({
        baseURL:
          `https://manage.devcenter.microsoft.com/v2.0/my/hardware/products/` +
          productId +
          `/submissions`,
        headers: {
          Authorization: this.auth,
        },
        responseType: "json",
      })
      .post("/", payload)
      .then((res) => {
        this.submission = res.data;
      })
      .catch((err) => {
        console.log(err);
        //core.setFailed(`${ERRORS.INVALID_CREDENTIALS}}: ${err}`);
      });

    return true;
  }

  async uploadFile(url, path) {
    const binary = await require("fs/promises").readFile(path);

    var res = await axios({
      method: "PUT",
      url: url,
      headers: { "x-ms-blob-type": "BlockBlob" },
      data: binary,
    });

    if (res.status != 201) throw "error";
    return true;
  }

  async commitSubmission(productId, submissionId) {
    var url =
      `https://manage.devcenter.microsoft.com/v2.0/my/hardware/products/` +
      productId +
      `/submissions/` +
      submissionId +
      `/commit`;
    var res = await axios({
      method: "POST",
      url: url,
      headers: {
        Authorization: this.auth,
        "Content-Type": "application/json",
      },
    });

    if (res.status != 202) throw "error";

    return true;
  }

  async querySubmission(productId, submissionId) {
    var url =
      `https://manage.devcenter.microsoft.com/v2.0/my/hardware/products/` +
      productId +
      `/submissions/` +
      submissionId;
    await axios
      .get(url, { headers: { Authorization: this.auth } })
      .then((res) => {
        this.status = res.data;
      })
      .catch((err) => {
        console.log("err:", err);
      });

    return true;
  }
};

async function downloadFileFromUrl(url, file) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  fs.writeFileSync(file, new Buffer.from(res.data), "binary");
}

async function main() {
  var session = new Session(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
  await session.init();

  console.log("create new product...");
  await session.newProduct(PRODUCT_NAME);
  var productIdStr = session.product["links"][0]["href"]
    .split("/")
    .slice(-1)[0];
  console.log("created product id: ", productIdStr);

  console.log("create new submission...");
  await session.newSubmission(productIdStr, PRODUCT_NAME);
  var submissionIdStr = session.submission["links"][0]["href"]
    .split("/")
    .slice(-1)[0];
  console.log("created submission id: ", submissionIdStr);

  var uploadUrl = session.submission["downloads"]["items"][0]["url"];
  console.log("upload url: ", uploadUrl);

  console.log("upload to blob...");
  var uploaded = await session.uploadFile(uploadUrl, BIN_PATH_IN);
  console.log(uploaded);
  console.log("the file has been uploaded to blob");

  console.log("commit submission...");
  var commit_retry_count = 0;
  while (true) {
    try {
      var commited = await session.commitSubmission(
        productIdStr,
        submissionIdStr
      );
      if (commited) break;
    } catch (err) {
      console.log(err);
      if (commit_retry_count < 10) {
        commit_retry_count += 1;
        continue;
      } else {
        //SubmissionCommitFailedException
      }
    }
  }
  console.log("submission has been committed");
  console.log("wait for the submission to complete");

  var previousStep = "";
  while (true) {
    //Refresh session every time, othwerwise, the status will show same forever.
    session = new Session(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    await session.init();

    await session.querySubmission(productIdStr, submissionIdStr);
    var step = session.status["workflowStatus"]["currentStep"];
    var state = session.status["workflowStatus"]["state"];

    if (previousStep) {
      if (previousStep != step) {
        console.log("step has been changed to:", step);
        previousStep = step;
      }
    } else {
      console.log("current step:", step);
      previousStep = step;
    }
    if (state == "completed") {
      console.log("the submission has been completed successfully");
      var foundSignedPackage = false;
      while (!foundSignedPackage) {
        var items = session.status["downloads"]["items"];
        for (var index = 0; index < items.length; index++) {
          var v = items[index];
          if (v["type"] == "signedPackage") {
            console.log("signed package download url:", v["url"]);
            var zipFileName = "signed.zip";
            await downloadFileFromUrl(v["url"], zipFileName);
            //fs.createReadStream(zipFileName).pipe(
            //  unzip.Extract({ path: "./signed" })
            //);
            try {
            } catch (error) {}
            foundSignedPackage = true;
            break;
          }
        }
        if(foundSignedPackage)
          break;
        session = new Session(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
        await session.init();
        await session.querySubmission(productIdStr, submissionIdStr);
        await sleep(5000);
      }
      break;
    } else if (state == "failed") {
      throw "error";
    }
    await sleep(5000);
  }
  console.log("done");
}

main();

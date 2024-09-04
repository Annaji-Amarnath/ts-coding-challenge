import { Given, When, Then } from "@cucumber/cucumber";
import { HederaService, accounts } from "../../src/hederaService";
import { PrivateKey, KeyList } from "@hashgraph/sdk";
import assert from "node:assert";

const zerothAcct = accounts[0];
const firstAcct = accounts[1];
const zerothHederaService = new HederaService(zerothAcct);
const firstHederaService = new HederaService(firstAcct);

let topicId: string;
let expectedMessage: string;

Given(
  /^a first account with more than (\d+) hbars$/,
  async function (expectedBalance: number) {
    const balance = await zerothHederaService.getAccountBalance();
    assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance, `Balance should be greater than ${expectedBalance}`);
  }
);

When(
  /^A topic is created with the memo "([^"]*)" with the first account as the submit key$/,
  async function (memo: string) {
    const submitKey = PrivateKey.generate();
    topicId = await zerothHederaService.createTopicWithSubmitKey(memo, submitKey);
  }
);

When(
  /^The message "([^"]*)" is published to the topic$/,
  async function (message: string) {
    expectedMessage = message;
    const status = await zerothHederaService.submitMessageToTopic(topicId, message);
    console.info(`Message submission transaction status: ${status}`);
  }
);

Then(
  /^The message "([^"]*)" is received by the topic and can be printed to the console$/,
  async function (message: string) {
    await zerothHederaService.subscribeToTopic(topicId, (receivedMessage: string) => {
      console.log(`Received message: ${receivedMessage}`);
      assert.strictEqual(receivedMessage, expectedMessage, `Expected message to be ${expectedMessage}`);
    });
  }
);

Given(
  /^A second account with more than (\d+) hbars$/,
  async function (expectedBalance: number) {
    const balance = await firstHederaService.getAccountBalance();
    assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance, `Balance should be greater than ${10 * 1e8}`);
  }
);

Given(
  /^A (\d+) of (\d+) threshold key with the first and second account$/,
  async function (thresholdValue: number, size: number) {

    const keyList = new KeyList([
      (await zerothHederaService.getAcctIdAndPrivateKey()).privateKey,
      (await firstHederaService.getAcctIdAndPrivateKey()).privateKey,
    ]);
    this.thresholdKey = keyList.setThreshold(thresholdValue);
    console.log(`Threshold key structure: ${this.thresholdKey}`);

    assert.ok(this.thresholdKey.threshold === thresholdValue);
  }
);

When(/^A topic is created with the memo "([^"]*)" with the threshold key as the submit key$/, async function (memo: string) {
  this.topicId = await firstHederaService.createTopicWithSubmitKey(memo, this.thresholdKey);
  console.log(`New topic id: ${this.topicId}`);

  const topicInfo = await firstHederaService.getTopicInfo(this.topicId);

  assert.ok(topicInfo.topicMemo === memo);
});

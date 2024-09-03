import { Given, Then, When, setDefaultTimeout } from "@cucumber/cucumber";
import { Client, KeyList, TopicMessageQuery } from "@hashgraph/sdk";
import assert from "node:assert";
import { accounts } from "../../src/config";
import { hederaApi } from "../../src/hederaUtils";

// Set default timeout for cucumber
setDefaultTimeout(60000);

// Pre-configured client for test network (testnet)
const client = Client.forTestnet();

//Set the operator with the account ID and private key
Given(
  /^a first account with more than (\d+) hbars$/,
  async function (expectedBalance: number) {
    const accDetails = hederaApi.getAccountDetails(accounts[0]);
    this.accountId = accDetails.accountId;
    this.privateKey = accDetails.privateKey;
    client.setOperator(this.accountId, this.privateKey);

    const balance = await hederaApi.getAccountBalance(this.accountId, client, null);
    console.info(`Balance of first account: ${balance}`);

    assert.ok(balance > expectedBalance);
  }
);

When(
  /^A topic is created with the memo "([^"]*)" with the first account as the submit key$/,
  async function (memo: string) {
    this.topicId = await hederaApi.createTopic(memo, this.privateKey.publicKey, client);
    console.info(`Created topic id: ${this.topicId}`);

    // Wait 5 seconds between consensus topic creation and subscription creation
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const topicInfo = await hederaApi.getTopicInfo(this.topicId, client);

    assert.ok(
      topicInfo.topicMemo === memo &&
        topicInfo.submitKey?.toString() === this.privateKey.publicKey.toString()
    );
  }
);

When(
  /^The message "([^"]*)" is published to the topic$/,
  async function (message: string) {
    const status = await hederaApi.submitMessageToTopic(
      message,
      this.topicId,
      this.privateKey,
      client
    );
    console.info(`Message submission transaction status: ${status}`);
  }
);

Then(
  /^The message "([^"]*)" is received by the topic and can be printed to the console$/,
  async function (message: string) {
    let messageAsString;

    new TopicMessageQuery()
      .setTopicId(this.topicId)
      .setStartTime(0)
      .subscribe(client, null, (message) => {
        messageAsString = Buffer.from(message.contents).toString();
        console.info(
          `${message.consensusTimestamp.toDate()} received: ${messageAsString}`
        );
      });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.info(`Message received from the topic: ${messageAsString}`);
    assert.ok(messageAsString === message);
  }
);

Given(
  /^A second account with more than (\d+) hbars$/,
  async function (expectedBalance: number) {
    const accDetails = hederaApi.getAccountDetails(accounts[2]);
    this.accountId2 = accDetails.accountId;
    this.privateKey2 = accDetails.privateKey;

    const balance = await hederaApi.getAccountBalance(this.accountId2, client, null);
    console.info(`Balance of second account: ${balance}`);

    assert.ok(balance > expectedBalance);
  }
);

Given(
  /^A (\d+) of (\d+) threshold key with the first and second account$/,
  async function (thresholdValue: number, size: number) {
    assert.ok(thresholdValue <= size);

    const publicKeyList = [];
    publicKeyList.push(this.privateKey.publicKey);
    publicKeyList.push(this.privateKey2.publicKey);

    assert.ok(publicKeyList.length == size);

    this.thresholdKey = new KeyList(publicKeyList, thresholdValue);
    console.info(`Threshold key structure: ${this.thresholdKey}`);

    assert.ok(this.thresholdKey.threshold === thresholdValue);
  }
);

When(
  /^A topic is created with the memo "([^"]*)" with the threshold key as the submit key$/,
  async function (memo: string) {
    this.topicId = await hederaApi.createTopic(memo, this.thresholdKey, client);
    console.info(`New topic id: ${this.topicId}`);

    // Wait 5 seconds between consensus topic creation and subscription creation
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const topicInfo = await hederaApi.getTopicInfo(this.topicId, client);

    assert.ok(
      topicInfo.topicMemo === memo &&
        topicInfo.submitKey?.toString() === this.thresholdKey.toString()
    );
  }
);

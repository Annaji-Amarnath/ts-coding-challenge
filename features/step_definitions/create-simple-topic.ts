import { Given, Then, When, setDefaultTimeout } from "@cucumber/cucumber";
import {
  AccountId,
  Client,
  PrivateKey,
  TokenSupplyType,
  TokenType,
  Transaction,
  TokenInfo,
  Status,
  AccountBalance,
  TransactionId,
  TransferTransaction,
  TransactionReceipt,
  TransactionResponse,
  Hbar,
} from "@hashgraph/sdk";
import assert from "node:assert";
import { HederaService, accounts } from "../../src/hederaService";

const zerothAcct = accounts[0];
const firstAcct = accounts[1];
const zerothHederaService = new HederaService(zerothAcct);
const firstHederaService = new HederaService(firstAcct);

const secondHederaService = new HederaService(accounts[2]);
const thirdHederaService = new HederaService(accounts[3]);

setDefaultTimeout(120000);

Given(
  /^A Hedera account with more than (\d+) hbar$/,
  async function (expectedBalance: number) {
    const balance = await zerothHederaService.getAccountBalance();
    assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
  }
);

When(/^I create a token named Test Token \(HTT\)$/, async function () {
  const receipt = await zerothHederaService.createAccountToken(
    0,
    TokenType.FungibleCommon,
    TokenSupplyType.Infinite,
    undefined
  );
  const submitStatus = receipt.status;
  this.tokenId = receipt.tokenId;
  assert.equal(submitStatus.toString(), "SUCCESS");
});

Then(/^The token has the name "([^"]*)"$/, async function (name: string) {
  const tokenInfo: TokenInfo = await zerothHederaService.getTokenInfo(
    this.tokenId
  );
  this.tokenInfo = tokenInfo;
  assert.equal(name, tokenInfo.name);
});

Then(/^The token has the symbol "([^"]*)"$/, async function (symbol: string) {
  assert.equal(symbol, this.tokenInfo.symbol);
});

Then(/^The token has (\d+) decimals$/, async function (decimals: number) {
  assert.equal(+decimals, +this.tokenInfo.decimals);
});

Then(/^The token is owned by the account$/, async function () {
  const accountId = await (
    await zerothHederaService.getAcctIdAndPrivateKey()
  ).accountId;
  assert.equal(
    accountId.toString(),
    this.tokenInfo.treasuryAccountId.toString()
  );
});

Then(
  /^An attempt to mint (\d+) additional tokens succeeds$/,
  async function (mint: number) {
    const transactionStatus: Status = await zerothHederaService.getMintToken(
      this.tokenId,
      mint
    );

    assert.equal(transactionStatus.toString(), "SUCCESS");
  }
);

When(
  /^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/,
  async function (numTokens: number) {
    const receipt = await zerothHederaService.createAccountToken(
      numTokens,
      TokenType.FungibleCommon,
      TokenSupplyType.Finite,
      numTokens
    );
    this.tokenId = receipt.tokenId;
    const transactionStatus = receipt.status;
    assert.equal(transactionStatus.toString(), "SUCCESS");
  }
);
Then(
  /^The total supply of the token is (\d+)$/,
  async function (totalSupply: number) {
    const tokenInfo = await zerothHederaService.getTokenInfo(this.tokenId);
    assert.equal(totalSupply, +tokenInfo.totalSupply);
  }
);
Then(/^An attempt to mint tokens fails$/, async function () {
  try {
    const transactionStatus: Status = await zerothHederaService.getMintToken(
      this.tokenId,
      2
    );
    assert.equal(transactionStatus.toString(), "SUCCESS");
  } catch (err: any) {
    assert.equal(String(err.status), "TOKEN_MAX_SUPPLY_REACHED");
  }
});
// sec ===>> 3
Given(
  /^A first hedera account with more than (\d+) hbar$/,
  async function (expectedBalance: number) {
    const balance = await secondHederaService.getAccountBalance();
    assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
  }
);
Given(/^A second Hedera account$/, async function () {
  const { accountId, privateKey } =
    await thirdHederaService.getAcctIdAndPrivateKey();
  this.thirdAccId = accountId;
  this.thirdPrivKey = privateKey;
});
Given(
  /^A token named Test Token \(HTT\) with (\d+) tokens$/,
  async function (numTokens: number) {
    const { accountId, privateKey } =
      await zerothHederaService.getAcctIdAndPrivateKey();
    this.treasuryAccountId = accountId;
    this.treasuryPrivKey = privateKey;
    const receipt = await zerothHederaService.createAccountToken(
      numTokens,
      TokenType.FungibleCommon,
      TokenSupplyType.Finite,
      numTokens
    );
    this.tokenId = receipt.tokenId;
    const transactionStatus = receipt.status;
    assert.equal(transactionStatus.toString(), "SUCCESS");
  }
);
Given(
  /^The first account holds (\d+) HTT tokens$/,
  async function (tokenBalance: number) {
    try {
      const { accountId: secondAccId, privateKey: secondPrivKey } =
        await firstHederaService.getAcctIdAndPrivateKey();
      const firstAccAssociateStatus =
        await zerothHederaService.associateAccountToken(
          this.tokenId,
          secondAccId,
          secondPrivKey
        );
      const transactionStatus: any = await zerothHederaService.transferAToken(
        this.tokenId,
        this.treasuryAccountId,
        secondAccId,
        tokenBalance,
        this.treasuryPrivKey
      );
      assert.equal(firstAccAssociateStatus.toString(), "SUCCESS");
      assert.equal(transactionStatus.toString(), "SUCCESS");
    } catch (err) {}
    const balance = await firstHederaService.getAccountBalance();
    assert.equal(balance.tokens?.get(this.tokenId).toNumber(), tokenBalance);
  }
);
Given(
  /^The second account holds (\d+) HTT tokens$/,
  async function (tokenBalance: number) {
    const { accountId, privateKey } =
      await firstHederaService.getAcctIdAndPrivateKey();

    try {
      const secondAccAssociateStatus =
        await zerothHederaService.associateAccountToken(
          this.tokenId,
          accountId,
          privateKey
        );

      const transactionStatus = await zerothHederaService.transferAToken(
        this.tokenId,
        this.treasuryAccountId,
        accountId,
        tokenBalance,
        this.treasuryPrivKey
      );
      assert.equal(secondAccAssociateStatus.toString(), "SUCCESS");
      assert.equal(transactionStatus.toString(), "SUCCESS");
    } catch (err) {}

    const balance = await firstHederaService.getAccountBalance();
    assert.equal(balance.tokens?.get(this.tokenId).toNumber(), tokenBalance);
  }
);
When(
  /^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/,
  async function (amount: number) {
    const { accountId: zerothAccId } =
      await zerothHederaService.getAcctIdAndPrivateKey();
    const { accountId: firstAccId } =
      await firstHederaService.getAcctIdAndPrivateKey();
    const transaction = await zerothHederaService.transferAToken(
      this.tokenId,
      zerothAccId,
      firstAccId,
      amount,
      undefined
    );

    this.tokenTransferTransaction = transaction;
    console.log(
      "Token transfer transaction from first account to second account created"
    );
  }
);
When(/^The first account submits the transaction$/, async function () {
  try {
    const { privateKey } = await zerothHederaService.getAcctIdAndPrivateKey();
    this.balanceBeforeTx = await zerothHederaService.getAccountBalance();
    const client = zerothHederaService.clientInstant;
    const signTx = await this.tokenTransferTransaction.sign(privateKey);
    const transferRx = await signTx.execute(client);
    const receipt = await transferRx.getReceipt(client);
  } catch (err) {}
  this.balanceAfterTx = await zerothHederaService.getAccountBalance();
});
When(
  /^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/,
  async function (amount: number) {
    // const newClient = Client.forTestnet().setOperator(this.secondAccId, this.secondPrivKey);
    const { accountId: firstAccId } =
      await zerothHederaService.getAcctIdAndPrivateKey();
    const { accountId: secondAccId } =
      await firstHederaService.getAcctIdAndPrivateKey();
    const client = await firstHederaService.clientInstant;

    this.transferTransaction = await firstHederaService.transferAToken(
      this.tokenId,
      secondAccId,
      firstAccId,
      amount,
      undefined
    );
    const signTx: Transaction = await this.transferTransaction
      .setTransactionId(TransactionId.generate(firstAccId))
      .freezeWith(client);
    this.tokenTransferTransaction = signTx;
    console.log(
      `Token transfer transaction from second account to first account created`
    );
  }
);
Then(/^The first account has paid for the transaction fee$/, async function () {
  assert.ok(this.balanceBeforeTx > this.balanceAfterTx);
});
Given(
  /^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/,
  async function (expectedBalance: number, tokenBalance: number) {}
);
Given(
  /^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  async function (accountBalance: number, tokenBalance: number) {}
);
Given(
  /^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  async function (accountBalance: number, tokenBalance: number) {}
);
Given(
  /^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  async function (accountBalance: number, tokenBalance: number) {}
);
When(
  /^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/,
  async function (tr1, tr3, tr4) {}
);

Then(
  /^The third account holds (\d+) HTT tokens$/,
  async function (tokenBalance: number) {
    const thirdAccBalance: AccountBalance =
      await secondHederaService.getAccountBalance();
    assert.equal(
      thirdAccBalance.tokens?.get(this.tokenId).toNumber(),
      tokenBalance
    );
  }
);
Then(
  /^The fourth account holds (\d+) HTT tokens$/,
  async function (tokenBalance: number) {
    const fourthAccBalance: AccountBalance =
      await thirdHederaService.getAccountBalance();
    assert.equal(
      fourthAccBalance.tokens?.get(this.tokenId).toNumber(),
      tokenBalance
    );
  }
);

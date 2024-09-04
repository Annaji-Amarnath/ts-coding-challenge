import {
  Client,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
  TopicInfoQuery,
  Hbar,
  KeyList,
  AccountBalanceQuery,
  TopicInfo,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
  Status,
  TokenMintTransaction,
  TokenInfoQuery,
  TokenInfo,
  TokenAssociateTransaction,
  TransferTransaction,
  Transaction,
  AccountBalance,
  TransactionReceipt,
  AccountCreateTransaction,
} from "@hashgraph/sdk";

export interface Account {
  id: string;
  privateKey: string;
}

export const accounts: Account[] = [
  {
    id: "0.0.4736208",
    privateKey:
      "302e020100300506032b6570042204208b75da3e8d63bc1d89c86c04a55eca860b7dcd5845382ac2dcdf0fd56971c769",
  },
  {
    id: "0.0.4811041",
    privateKey:
      "302e020100300506032b657004220420f9a1edd37431b1b5065dd9f5b0dbfc7fd4c4f20bacbde4eaefe9bc2996330781",
  },
  {
    id: "0.0.4800114",
    privateKey:
      "302e020100300506032b657004220420fd5878ed50a6192c2fe36cb3b386be1d09d01b1efc2c974ebde98f8378c80ecc",
  },
  {
    id: "0.0.4809676",
    privateKey:
      "302e020100300506032b657004220420eabdc12cd2f91a84b2c2ef216399928b1e9708f11f23b7bbebc7b994239f4b2f",
  },
  {
    id: "0.0.4482935",
    privateKey:
      "302e020100300506032b657004220420e6ea695940d0e2a2d747d0cff1ee65c0a48688c8c7381596ee738a0f8e891413",
  },
  {
    id: "0.0.4482934",
    privateKey:
      "302e020100300506032b6570042204206be6a20416741195b268b2dd6fd5584d141b2bdd07b4126c31a1925d425631cc",
  },
];

export class HederaService {
  private client: Client;
  private accountId: AccountId;
  private privateKey: PrivateKey;
  private supplyKey: PrivateKey;

  constructor(account: Account) {
    this.accountId = AccountId.fromString(account.id);
    this.privateKey = PrivateKey.fromStringED25519(account.privateKey);
    this.supplyKey = PrivateKey.generate();
    this.client = Client.forTestnet().setOperator(
      this.accountId,
      this.privateKey
    );
  }
  get clientInstant() {
    return this.client;
  }
  async getAcctIdAndPrivateKey(): Promise<{
    accountId: AccountId;
    privateKey: PrivateKey;
  }> {
    return {
      accountId: this.accountId,
      privateKey: this.privateKey,
    };
  }

  async getAccountBalance(): Promise<AccountBalance> {
    const query = new AccountBalanceQuery().setAccountId(this.accountId);
    const balance = await query.execute(this.client);
    console.log(
      "balance.tokens?.get(this.tokenId).toNumber() ---->>>",
      balance.hbars.toBigNumber().toNumber()
    );
    return balance;
  }

  async createTopicWithSubmitKey(
    memo: string,
    submitKey: PrivateKey | KeyList
  ): Promise<string> {
    const transaction = new TopicCreateTransaction()
      .setTopicMemo(memo)
      .setSubmitKey(submitKey) // Now properly accepting PrivateKey or KeyList
      .freezeWith(this.client);

    const response = await transaction.execute(this.client);
    const receipt = await response.getReceipt(this.client);
    return receipt.topicId!.toString();
  }

  async submitMessageToTopic(
    topicId: string,
    message: string,
    privateKey?: PrivateKey
  ): Promise<void> {
    let transaction = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .freezeWith(this.client);

    if (privateKey) {
      transaction = await transaction.sign(privateKey);
    }

    await transaction.execute(this.client);
  }

  async subscribeToTopic(
    topicId: string,
    callback: (message: string) => void
  ): Promise<void> {
    new TopicMessageQuery()
      .setTopicId(topicId)
      .subscribe(this.client, null, (response) => {
        const receivedMessage = Buffer.from(response.contents).toString();
        callback(receivedMessage);
      });
  }

  async getTopicInfo(topicId: string): Promise<TopicInfo> {
    const topicInfo = await new TopicInfoQuery()
      .setTopicId(topicId)
      .execute(this.client);

    return topicInfo;
  }
  async createAccountToken(
    initialSupply: number,
    tokenType: TokenType,
    supplyType: TokenSupplyType,
    maxSupply: number | undefined
  ) {
    const transaction = await new TokenCreateTransaction()
      .setTokenName("Test Token")
      .setTokenSymbol("HTT")
      .setDecimals(2)
      .setTreasuryAccountId(this.accountId)
      .setInitialSupply(initialSupply)
      .setTokenType(tokenType)
      .setSupplyType(supplyType)
      .setSupplyKey(this.supplyKey.publicKey)
      .setMaxTransactionFee(new Hbar(100))
      .setMaxSupply(maxSupply)
      .freezeWith(this.client);

    const signTx = await transaction.sign(this.privateKey);
    const txResponse = await signTx.execute(this.client);
    return txResponse.getReceipt(this.client);
  }

  async getMintToken(tokenId: TokenId, mintAmount: number): Promise<Status> {
    const transaction: TokenMintTransaction = await new TokenMintTransaction()
      .setTokenId(tokenId)
      .setAmount(mintAmount)
      .setMaxTransactionFee(new Hbar(10)) //Use when HBAR is under 10 cents
      .freezeWith(this.client);

    const signTx = await transaction.sign(this.supplyKey);
    const txResponse = await signTx.execute(this.client);
    const receipt = await txResponse.getReceipt(this.client);
    const transactionStatus = receipt.status;
    return transactionStatus;
  }
  async getTokenInfo(tokenId: TokenId): Promise<TokenInfo> {
    return new TokenInfoQuery().setTokenId(tokenId).execute(this.client);
  }

  async associateAccountToken(
    tokenId: TokenId,
    accountId: AccountId,
    privateKey: PrivateKey
  ): Promise<Status> {
    const transaction = await new TokenAssociateTransaction()
      .setAccountId(accountId)
      .setTokenIds([tokenId])
      .freezeWith(this.client);

    const signTx = await transaction.sign(privateKey);
    const txResponse = await signTx.execute(this.client);
    const receipt = await txResponse.getReceipt(this.client);
    return receipt.status;
  }
  async transferAToken(
    tokenId: TokenId,
    sourAccountId: AccountId,
    destAccountId: AccountId,
    tokenBalance: number,
    sourPrivKey: PrivateKey | undefined
  ): Promise<Status | Transaction> {
    const transaction = await new TransferTransaction()
      .addTokenTransfer(tokenId, sourAccountId, -1 * tokenBalance)
      .addTokenTransfer(tokenId, destAccountId, tokenBalance);

    if (sourPrivKey !== undefined) {
      const signTx = await (
        await transaction.freezeWith(this.client)
      ).sign(sourPrivKey);
      const txResponse = await signTx.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      return receipt.status;
    }
    return transaction;
  }
  async submitTransaction(
    transaction: Transaction
  ): Promise<TransactionReceipt> {
    const signTx = await transaction.sign(this.privateKey);

    const transferRx = await signTx.execute(this.client);

    const receipt = await transferRx.getReceipt(this.client);

    return receipt;
  }

  async createAnAccount(
    initialBalance: number
  ): Promise<{ accountId: AccountId | null; privateKey: PrivateKey }> {
    const privateKey = PrivateKey.generate();

    const transaction = await new AccountCreateTransaction()
      .setInitialBalance(initialBalance)
      .setKey(privateKey)
      .execute(this.client);
    const receipt = await transaction.getReceipt(this.client);
    const accountId = receipt.accountId;

    return { accountId, privateKey };
  }
}

import {
  AccountBalanceQuery,
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  PublicKey,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenInfoQuery,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TopicCreateTransaction,
  TopicId,
  TopicInfoQuery,
  TopicMessageSubmitTransaction,
  TransactionId,
  TransferTransaction,
} from "@hashgraph/sdk";

const createAccount = async (client: Client, initialBalance: number) => {
  const privateKey = PrivateKey.generate();

  const receipt = await (
    await new AccountCreateTransaction()
      .setInitialBalance(initialBalance)
      .setKey(privateKey)
      .execute(client)
  ).getReceipt(client);
  const accountId = receipt.accountId;

  return { accountId, privateKey };
};

const getAccountDetails = (acc: { id: string; privateKey: string }) => {
  const accountId = AccountId.fromString(acc.id);
  const privateKey = PrivateKey.fromStringED25519(acc.privateKey);

  return { accountId, privateKey };
};

const getAccountBalance = async (
  accountId: AccountId,
  client: Client,
  tokenId: TokenId | null
) => {
  const accountBalanceTx = await new AccountBalanceQuery()
    .setAccountId(accountId)
    .execute(client);

  let balance;
  if (tokenId === null) {
    balance = await accountBalanceTx.hbars.toBigNumber().toNumber();
  } else {
    balance = accountBalanceTx.tokens?.get(tokenId).toNumber();
  }

  return balance;
};

const createTopic = async (
  memo: string,
  submitKey: PublicKey,
  client: Client
) => {
  const topicCreateTx = new TopicCreateTransaction()
    .setSubmitKey(submitKey)
    .setTopicMemo(memo);

  const topicCreateRx = await topicCreateTx.execute(client);

  const receipt = await topicCreateRx.getReceipt(client);

  return receipt.topicId;
};

const getTopicInfo = async (topicId: TopicId, client: Client) => {
  const topicInfo = await new TopicInfoQuery()
    .setTopicId(topicId)
    .execute(client);

  return topicInfo;
};

const submitMessageToTopic = async (
  message: string,
  topicId: TopicId,
  privateKey: PrivateKey,
  client: Client
) => {
  const submitMsgTx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .freezeWith(client);

  const submitMsgRx = await (
    await submitMsgTx.sign(privateKey)
  ).execute(client);

  const receipt = await submitMsgRx.getReceipt(client);

  return receipt.status;
};

const createToken = async (
  supplyType: TokenSupplyType,
  initialSupply: number,
  maxSupply: number | null,
  accountId: AccountId,
  privateKey: PrivateKey,
  client: Client
) => {
  //Generate a supply key
  const supplyKey = PrivateKey.generate();

  //Create the transaction
  let tokenCreateTx = new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(2)
    .setTreasuryAccountId(accountId)
    .setSupplyType(supplyType)
    .setSupplyKey(supplyKey.publicKey)
    .setInitialSupply(initialSupply)
    .setMaxTransactionFee(new Hbar(100));

  if (supplyType === TokenSupplyType.Finite && maxSupply !== null) {
    tokenCreateTx = tokenCreateTx.setMaxSupply(maxSupply);
  }

  tokenCreateTx = tokenCreateTx.freezeWith(client);

  const tokenCreateRx = await (
    await tokenCreateTx.sign(privateKey)
  ).execute(client);

  const receipt = await tokenCreateRx.getReceipt(client);

  const tokenId = receipt.tokenId;

  return { tokenId, supplyKey };
};

const getTokenInfo = async (tokenId: TokenId, client: Client) => {
  const tokenInfo = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);

  return tokenInfo;
};

const mintToken = async (
  tokenId: TokenId,
  numberOfTokensToMint: number,
  supplyKey: PrivateKey,
  client: Client
) => {
  const tokenMintTx = new TokenMintTransaction()
    .setTokenId(tokenId)
    .setAmount(numberOfTokensToMint)
    .setMaxTransactionFee(new Hbar(100))
    .freezeWith(client);

  const tokenMintRx = await (await tokenMintTx.sign(supplyKey)).execute(client);

  const receipt = await tokenMintRx.getReceipt(client);

  return receipt.status;
};

const associateToken = async (
  tokenId: TokenId,
  accountId: AccountId,
  privateKey: PrivateKey,
  client: Client
) => {
  const tokenAssociateTx = new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([tokenId])
    .freezeWith(client);

  const tokenAssociateRx = await (
    await tokenAssociateTx.sign(privateKey)
  ).execute(client);

  let receipt = await tokenAssociateRx.getReceipt(client);

  return receipt.status;
};

const transferToken = async (
  tokenId: TokenId,
  accountIdFrom: AccountId,
  accountIdTo: AccountId,
  tokenBalance: number,
  transactionId: TransactionId | null,
  privateKey: PrivateKey | null,
  client: Client
) => {
  let tokenTransferTx = new TransferTransaction()
    .addTokenTransfer(tokenId, accountIdFrom, -1 * tokenBalance)
    .addTokenTransfer(tokenId, accountIdTo, tokenBalance);

  if (transactionId !== null) {
    tokenTransferTx = tokenTransferTx.setTransactionId(transactionId);
  }

  tokenTransferTx = tokenTransferTx.freezeWith(client);

  if (privateKey !== null) {
    tokenTransferTx = await tokenTransferTx.sign(privateKey);

    if (transactionId !== null) {
      return tokenTransferTx;
    }

    const tokenTransferRx = await tokenTransferTx.execute(client);

    let receipt = await tokenTransferRx.getReceipt(client);

    return receipt.status;
  } else {
    return tokenTransferTx;
  }
};

export const hederaApi = {
  createAccount,
  getAccountDetails,
  getAccountBalance,
  createTopic,
  getTopicInfo,
  submitMessageToTopic,
  createToken,
  getTokenInfo,
  mintToken,
  associateToken,
  transferToken,
};

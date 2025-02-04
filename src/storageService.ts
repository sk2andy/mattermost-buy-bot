import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { Dialog, DialogBuilder } from "./mattermost";

// Setup Azure Table Client
const tableNameBuys = "Buys";
const tableNameInterests = "Interests";
const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || "";
const storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || "";
const tableClientBuys = new TableClient(
  `https://${storageAccountName}.table.core.windows.net`,
  tableNameBuys,
  new AzureNamedKeyCredential(storageAccountName, storageAccountKey)
);

export interface BuyEntity {
  partitionKey: string;
  rowKey: string;
  creatorUserId: string;
  buyId: string;
  channelId: string;
  name: string;
  unitForShares: "mg" | "ml" | "unit";
  shareSize: number;
  pricePerShare: number;
  description?: string;
  closed?: boolean;
  closedAt?: Date;
  paypal?: string;
  usdcWallet?: string;
  wiseId?: string;
}

export interface InterestEntity {
  partitionKey: string;
  rowKey: string;
  shares: number;
  email: string;
  userId: string;
  buyId: string;
  channelId: string;
  payed?: boolean;
}

const tableClientInterests = new TableClient(
  `https://${storageAccountName}.table.core.windows.net`,
  tableNameInterests,
  new AzureNamedKeyCredential(storageAccountName, storageAccountKey)
);

export async function saveBuyEntity(
  channelId: string,
  userId: string,
  buyId: string,
  name: string,
  unitForShares: "mg" | "ml" | "unit",
  shareSize: number,
  pricePerShare: number,
  description?: string,
  closed?: boolean,
  closedAt?: Date,
  paypal?: string,
  usdcWallet?: string,
  wiseId?: string
) {
  await tableClientBuys.upsertEntity({
    partitionKey: channelId,
    rowKey: buyId,
    channelId,
    name,
    unitForShares,
    pricePerShare,
    description,
    shareSize,
    creatorUserId: userId,
    buyId,
    closed,
    closedAt,
    paypal,
    usdcWallet,
    wiseId,
  });
}

export async function saveInterest(
  channelId: string,
  userId: string,
  buyId: string,
  shares: number,
  email: string,
  payed?: boolean
) {
  console.log("saveInterest", channelId, userId, buyId, shares, email);
  await tableClientInterests.upsertEntity({
    partitionKey: `${channelId}:${userId}`,
    rowKey: buyId,
    shares,
    email,
    userId,
    buyId,
    channelId,
    payed,
  });
}

export async function getInterestOfUser(
  channelId: string,
  buyId: string,
  userId: string
): Promise<InterestEntity | undefined> {
  if (!buyId) return Promise.resolve(undefined);

  try {
    const entity = await tableClientInterests.getEntity<InterestEntity>(
      `${channelId}:${userId}`,
      buyId
    );
    return entity;
  } catch (error) {
    return undefined;
  }
}

export async function getInterestsOfBuy(
  channelId: string,
  buyId: string
): Promise<InterestEntity[]> {
  const entitiesIterator = tableClientInterests.listEntities<InterestEntity>({
    queryOptions: {
      filter: `RowKey eq '${buyId}'`,
    },
  });

  const entities: InterestEntity[] = [];

  for await (const entity of entitiesIterator) {
    entities.push(entity);
  }

  return entities;
}

export async function getBuyEntity(
  channelId: string,
  buyId: string
): Promise<BuyEntity | undefined> {
  try {
    console.log("getBuyEntity", channelId, buyId);
    const entity = await tableClientBuys.getEntity<BuyEntity>(channelId, buyId);
    console.log("getBuyEntity", entity);
    return entity;
  } catch (error) {
    console.error("getBuyEntity", error);
    return undefined;
  }
}

export function createPaymentDetailsDialog(
  channelId: string,
  buyId: string
): Dialog {
  return new DialogBuilder("payment-details-dialog", "Enter payment details")
    .textElement({
      display_name: "Paypal",
      name: "paypal",
      optional: true,
      subtype: "text",
    })
    .textElement({
      display_name: "USDC Wallet",
      name: "usdc_wallet",
      optional: true,
      subtype: "text",
    })
    .textElement({
      display_name: "Wise ID",
      name: "wise_id",
      optional: true,
      subtype: "text",
    })
    .submitLabel("Submit")
    .notifyOnCancel(false)
    .state(JSON.stringify({ buy_id: buyId, channel_id: channelId }))
    .build();
}

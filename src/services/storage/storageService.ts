import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { Dialog, DialogBuilder } from "../mattermost";
import { singleton } from "tsyringe";

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

// Setup Azure Table Client
const tableNameBuys = "Buys";
const tableNameInterests = "Interests";
const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || "";
const storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || "";

@singleton()
export class StorageService {
  tableClientBuys = new TableClient(
    `https://${storageAccountName}.table.core.windows.net`,
    tableNameBuys,
    new AzureNamedKeyCredential(storageAccountName, storageAccountKey)
  );
  tableClientInterests = new TableClient(
    `https://${storageAccountName}.table.core.windows.net`,
    tableNameInterests,
    new AzureNamedKeyCredential(storageAccountName, storageAccountKey)
  );

  async saveBuyEntity(
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
    await this.tableClientBuys.upsertEntity({
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

  async saveInterest(
    channelId: string,
    userId: string,
    buyId: string,
    shares: number,
    email: string,
    payed?: boolean
  ) {
    console.log("saveInterest", channelId, userId, buyId, shares, email);
    await this.tableClientInterests.upsertEntity({
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

  async getInterestOfUser(
    channelId: string,
    buyId: string,
    userId: string
  ): Promise<InterestEntity | undefined> {
    if (!buyId) return Promise.resolve(undefined);

    try {
      const entity = await this.tableClientInterests.getEntity<InterestEntity>(
        `${channelId}:${userId}`,
        buyId
      );
      return entity;
    } catch (error) {
      return undefined;
    }
  }

  async getInterestsOfBuy(
    channelId: string,
    buyId: string
  ): Promise<InterestEntity[]> {
    const entitiesIterator =
      this.tableClientInterests.listEntities<InterestEntity>({
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

  async getBuyEntity(
    channelId: string,
    buyId: string
  ): Promise<BuyEntity | undefined> {
    try {
      console.log("getBuyEntity", channelId, buyId);
      const entity = await this.tableClientBuys.getEntity<BuyEntity>(
        channelId,
        buyId
      );
      console.log("getBuyEntity", entity);
      return entity;
    } catch (error) {
      console.error("getBuyEntity", error);
      return undefined;
    }
  }

  async isBuyClosed(channelId: string, buyId: string): Promise<boolean> {
    const buy = await this.getBuyEntity(channelId, buyId);
    return buy?.closed ?? false;
  }
}

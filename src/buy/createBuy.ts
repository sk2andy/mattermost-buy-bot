import {
  Dialog,
  DialogBuilder,
  MattermostDialogSubmission,
  Message,
  MessageBuilder,
  User,
} from "../mattermost";
import {
  BuyEntity,
  getBuyEntity,
  getInterestOfUser,
  InterestEntity,
  saveBuyEntity,
} from "../storageService";
import express from "express";

export async function createBuyDialog(
  triggerId: string,
  channelId: string,
  buyId?: string
): Promise<Dialog> {
  const buy = buyId ? await getBuyEntity(channelId, buyId) : undefined;

  const builder = new DialogBuilder("create-buy-dialog", "Create a Buy")
    .textElement({
      display_name: "Name of the Buy",
      name: "buy_name",
      optional: false,
      subtype: "text",
      default: buy?.name,
    })
    .textElement({
      display_name: "Description of the Buy",
      name: "buy_description",
      optional: true,
      subtype: "text",
      default: buy?.description,
    })
    .selectElement({
      display_name: "Unit for Shares",
      name: "unit_for_shares",
      optional: false,
      options: [
        { text: "mg", value: "mg" },
        { text: "ml", value: "ml" },
        { text: "unit", value: "unit" },
      ],
      default: buy?.unitForShares,
    })
    .textElement({
      display_name: "Share Size",
      name: "share_size",
      optional: false,
      subtype: "number",
      default: buy?.shareSize?.toString(),
    })
    .textElement({
      display_name: "Price per Share in USD",
      name: "price_per_share",
      optional: false,
      subtype: "number",
      default: buy?.pricePerShare?.toString(),
    })
    .submitLabel("Create")
    .state(JSON.stringify({ channel_id: channelId, buy_id: buyId }));

  return builder.build();
}

import { User, Message, MessageBuilder } from "../mattermost";
import { BuyEntity, getInterestOfUser } from "../storageService";

export async function createPaymentConfirmationMessage(
  channelId: string,
  buy: BuyEntity,
  buyer: User
): Promise<Message> {
  const interest = (await getInterestOfUser(channelId, buy.buyId, buyer.id))!;
  return new MessageBuilder()
    .text(
      `🎉 **Payment Confirmation Needed!** 🎉\n\n` +
        `**User:** ${buyer.username}\n` +
        `**Shares:** ${interest.shares}\n` +
        `**Total Amount:** ${interest.shares * buy.pricePerShare} USD\n` +
        `**Email:** ${interest?.email}\n\n` +
        `Please confirm the payment by clicking one of the buttons below:`
    )
    .attachment((attachment) =>
      attachment
        .button(
          "confirmpayment",
          "✅ Confirm Payment",
          `${process.env.BOT_URL}/confirm-payment`,
          {
            action: "confirmpayment",
            interest_id: interest,
            channel_id: channelId,
            user_id: buyer.id,
            buy_id: buy.buyId,
          }
        )
        .button(
          "rejectpayment",
          "❌ Reject Payment",
          `${process.env.BOT_URL}/reject-payment`,
          {
            action: "rejectpayment",
            interest_id: interest,
            channel_id: channelId,
            user_id: buyer.id,
            buy_id: buy.buyId,
          }
        )
        .build()
    )
    .build();
}

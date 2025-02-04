import { Message, MessageBuilder } from "../mattermost";
import { BuyEntity, InterestEntity } from "../storageService";

export function createPaymentMessage(
  buy: BuyEntity,
  interest: InterestEntity
): Message {
  const amountToPay = interest.shares * buy.pricePerShare;
  let text =
    `🎉 **"${buy.name}"** is now ready for payment! 🎉\n\n` +
    `**Share size:** ${buy.shareSize} ${buy.unitForShares}\n` +
    `**Price per share:** ${buy.pricePerShare} USD\n\n` +
    `**Amount to pay:** ${amountToPay} USD\n\n`;

  if (!buy.paypal && !buy.usdcWallet && !buy.wiseId) {
    text += `You will receive payment details later.`;
  } else {
    text += `Click on the button below to pay.`;
  }

  if (buy.paypal) {
    text += `\n\n**PayPal:** [Pay Now](https://www.paypal.me/${buy.paypal}/${amountToPay}USD)`;
  }

  if (buy.wiseId) {
    text += `\n\n**Wise:** [Pay Now](https://wise.com/pay/me/${buy.wiseId})`;
  }

  if (buy.usdcWallet) {
    text += `\n\n**USDC Wallet:** \`${buy.usdcWallet}\``;
  }

  return new MessageBuilder()
    .text(text)
    .attachment((attachment) =>
      attachment
        .button("payed", "Mark Payed", `${process.env.BOT_URL}/mark-payed`, {
          action: "payed",
          channel_id: interest.channelId,
          user_id: interest.userId,
          //token: submission.token,
          buy_id: interest.buyId,
        })
        .build()
    )
    .build();
}

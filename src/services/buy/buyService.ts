import {
  Dialog,
  DialogBuilder,
  MattermostClient,
  MattermostDialogSubmission,
  MattermostSlashCommandRequest,
  Message,
  MessageBuilder,
} from "../mattermost";
import "reflect-metadata";
import { container } from "tsyringe";
import { singleton } from "tsyringe";
import {
  BuyEntity,
  InterestEntity,
  StorageService,
} from "../storage/storageService";
import { MattermostPost } from "../mattermost/postAction";

@singleton()
export class BuyService {
  mattermost: MattermostClient;
  storageService: StorageService;
  botUrl: string;

  constructor() {
    this.mattermost = container.resolve(MattermostClient);
    this.storageService = container.resolve(StorageService);
    this.botUrl = process.env.BOT_URL!;
  }

  async startCreationProcess(command: MattermostSlashCommandRequest) {
    const dialog = await this.createBuyDialog(
      command.trigger_id,
      command.channel_id
    );

    await this.mattermost.openDialog(
      command.trigger_id,
      dialog,
      `${this.botUrl}/save-buy`
    );
  }

  async startEditProcess(post: MattermostPost) {
    const buyId = post.context.buy_id;
    const channelId = post.context.channel_id;
    const userId = post.user_id;
    if (await this.storageService.isBuyClosed(channelId, buyId)) {
      await this.mattermost.postEpemeralMessage(
        post.channel_id,
        userId,
        "Buy is already closed. You can't edit it."
      );
      return;
    }

    const buy = post?.context?.buy_id
      ? await this.storageService.getBuyEntity(channelId, buyId)
      : undefined;

    console.log("buy", channelId, buyId, buy);

    const dialog = await this.createBuyDialog(post.trigger_id, channelId, buy);
    await this.mattermost.openDialog(
      post.trigger_id,
      dialog,
      `${process.env.BOT_URL}/save-buy`
    );
  }

  async saveBuy(
    channelId: string,
    buyId: string,
    submission: MattermostDialogSubmission
  ) {
    const user = await this.mattermost.getUser(submission.user_id);

    await this.storageService.saveBuyEntity(
      submission.channel_id,
      submission.user_id,
      buyId,
      submission.submission.buy_name as string,
      submission.submission.unit_for_shares as "mg" | "ml" | "unit",
      submission.submission.share_size as number,
      submission.submission.price_per_share as number,
      submission.submission.buy_description as string
    );
    const reply = await this.createSaveBuyConfirmationMessage(
      submission,
      user.username,
      buyId
    );
    await this.mattermost.postMessage(channelId, reply);

    const manageReply = this.createManageMessage(submission, buyId);
    await this.mattermost.sendDirectMessage(submission.user_id, manageReply);
  }

  async closeBuy(post: MattermostPost) {
    const buyId = post.context.buy_id;
    const userId = post.user_id;
    const channelId = post.context.channel_id;
    if (await this.storageService.isBuyClosed(channelId, buyId)) {
      await this.mattermost.postEpemeralMessage(
        post.channel_id,
        userId,
        "Buy is already closed. You can't edit it."
      );
      return;
    }
    const dialog = this.createPaymentDetailsDialog(
      post.context.channel_id,
      post.context.buy_id
    );

    await this.mattermost.openDialog(
      post.trigger_id,
      dialog,
      `${process.env.BOT_URL}/close-buy-confirm`
    );
  }

  async confirmCloseBuy(
    submission: MattermostDialogSubmission,
    channelId: string,
    buyId: string
  ) {
    const buy: BuyEntity = (await this.storageService.getBuyEntity(
      channelId,
      buyId
    ))!;
    buy.paypal = submission.submission.paypal as string;
    buy.usdcWallet = submission.submission.usdc_wallet as string;
    buy.wiseId = submission.submission.wise_id as string;
    buy.closed = true;
    buy.closedAt = new Date();
    await this.storageService.saveBuyEntity(
      channelId,
      buy.creatorUserId,
      buyId,
      buy.name,
      buy.unitForShares,
      buy.shareSize,
      buy.pricePerShare,
      buy.description,
      buy.closed,
      buy.closedAt,
      buy.paypal,
      buy.usdcWallet,
      buy.wiseId
    );
    await this.mattermost.postMessage(
      channelId,
      new MessageBuilder()
        .text(
          `Buy **${buy?.name}** is closed now. You will receive individual payment messages.`
        )
        .channelId(channelId)
        .build()
    );

    const interestsOfBuy = await this.storageService.getInterestsOfBuy(
      channelId,
      buyId
    );

    for (const interest of interestsOfBuy) {
      const paymentMessage = this.createPaymentMessage(buy, interest);
      await this.mattermost.sendDirectMessage(interest.userId, paymentMessage);
    }
  }

  async remindPayment(post: MattermostPost) {
    const interests = await this.storageService.getInterestsOfBuy(
      post.context.channel_id,
      post.context.buy_id
    );

    for (const interest of interests) {
      if (!interest.payed) {
        const user = await this.mattermost.getUser(interest.userId);
        const buy = (await this.storageService.getBuyEntity(
          post.context.channel_id,
          post.context.buy_id
        ))!;
        await this.mattermost.sendDirectMessage(
          user.id,
          new MessageBuilder()
            .text(`Please pay for the buy **${buy.name}**`)
            .build()
        );
      }
    }
  }

  private async createSaveBuyConfirmationMessage(
    submission: MattermostDialogSubmission,
    username: string,
    buyId: string
  ): Promise<Message> {
    const reply = new MessageBuilder()
      .fromPayload(submission)
      .text(
        `🎉 ${username} successfully created a buy: **"${submission.submission.buy_name}"** 🎉\n\n` +
          (submission.submission.buy_description
            ? `**Description:** ${submission.submission.buy_description}\n\n`
            : "") +
          `**Share size:** ${submission.submission.share_size} ${submission.submission.unit_for_shares}\n` +
          `**Price per share:** ${submission.submission.price_per_share} USD\n\n` +
          `Are you interested? Click on the buttons below to engage!`
      )
      .attachment((attachment) =>
        attachment
          .text("Are you interested?")
          .pretext(
            "Click on 'Yes' to mark your interest or 'Create List' to see who else is interested."
          )
          .button("interest", "Yes", `${process.env.BOT_URL}/interest`, {
            action: "interested",
            team_id: submission.team_id,
            channel_id: submission.channel_id,
            user_id: submission.user_id,
            //token: submission.token,
            buy_id: buyId,
          })
          .build()
      )
      .build();

    return reply;
  }

  private createManageMessage(
    submission: MattermostDialogSubmission,
    buyId: string
  ): Message {
    const reply = new MessageBuilder()
      .fromPayload(submission)
      .text(
        `🎉 You successfully created a buy: **"${submission.submission.buy_name}"** 🎉\n\n` +
          (submission.submission.buy_description
            ? `**Description:** ${submission.submission.buy_description}\n\n`
            : "") +
          `**Share size:** ${submission.submission.share_size} ${submission.submission.unit_for_shares}\n` +
          `**Price per share:** ${submission.submission.price_per_share} USD\n\n` +
          `You can manage your buy by clicking on the buttons below.`
      )
      .attachment((attachment) =>
        attachment
          .text("Manage?")
          .button("buyedit", "Edit", `${process.env.BOT_URL}/edit-buy`, {
            action: "buyedit",
            team_id: submission.team_id,
            channel_id: submission.channel_id,
            user_id: submission.user_id,
            //token: submission.token,
            buy_id: buyId,
          })
          .button(
            "interestlist",
            "List interested",
            `${process.env.BOT_URL}/interestlist`,
            {
              action: "interestlist",
              team_id: submission.team_id,
              channel_id: submission.channel_id,
              user_id: submission.user_id,
              //token: submission.token,
              buy_id: buyId,
            }
          )
          .button("buyclose", "Close", `${process.env.BOT_URL}/close-buy`, {
            action: "buyclose",
            team_id: submission.team_id,
            channel_id: submission.channel_id,
            user_id: submission.user_id,
            //token: submission.token,
            buy_id: buyId,
          })
          .button(
            "remindpayment",
            "Remind Payment",
            `${process.env.BOT_URL}/remind-payment`,
            {
              action: "remindpayment",
              team_id: submission.team_id,
              channel_id: submission.channel_id,
              user_id: submission.user_id,
              //token: submission.token,
              buy_id: buyId,
            }
          )
          .build()
      )
      .build();

    return reply;
  }

  private async createBuyDialog(
    triggerId: string,
    channelId: string,
    buy?: BuyEntity
  ): Promise<Dialog> {
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
      .state(JSON.stringify({ channel_id: channelId, buy_id: buy?.buyId }));

    return builder.build();
  }

  private createPaymentDetailsDialog(channelId: string, buyId: string): Dialog {
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

  private createPaymentMessage(
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
}

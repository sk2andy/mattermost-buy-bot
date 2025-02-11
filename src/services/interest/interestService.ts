import "reflect-metadata";
import { container } from "tsyringe";
import { singleton } from "tsyringe";
import {
  BuyEntity,
  InterestEntity,
  StorageService,
} from "../storage/storageService";
import { MattermostPost } from "../mattermost/postAction";
import {
  Dialog,
  DialogBuilder,
  MattermostClient,
  Message,
  MessageBuilder,
  User,
} from "../mattermost";

@singleton()
export class InterestService {
  mattermost: MattermostClient;
  storageService: StorageService;
  botUrl: string;

  constructor() {
    this.mattermost = container.resolve(MattermostClient);
    this.storageService = container.resolve(StorageService);
    this.botUrl = process.env.BOT_URL!;
  }

  async startInterestProcess(post: MattermostPost): Promise<void> {
    const buyId = post.context?.buy_id;
    const channelId = post.channel_id;
    const userId = post.user_id;

    if (await this.storageService.isBuyClosed(channelId, buyId)) {
      await this.mattermost.postEpemeralMessage(
        channelId,
        userId,
        "Buy is already closed. You can't edit it."
      );
      return;
    }

    const interest = await this.storageService.getInterestOfUser(
      post.channel_id,
      post.context?.buy_id,
      post.user_id
    );
    const buy = (await this.storageService.getBuyEntity(channelId, buyId))!;
    const dialog = this.createInterestDialog(buy, interest);
    await this.mattermost.openDialog(
      post.trigger_id,
      dialog,
      `${process.env.BOT_URL}/save-interest`
    );
  }

  async saveInterest(submission: any) {
    const channelId = submission.channel_id;
    const userId = submission.user_id;
    const buyId = submission.state;

    if (await this.storageService.isBuyClosed(channelId, buyId)) {
      await this.mattermost.postEpemeralMessage(
        channelId,
        userId,
        "Buy is already closed. You can't edit it."
      );
      return;
    }

    const buy = await this.storageService.getBuyEntity(channelId, buyId);
    const shares = parseFloat(submission.submission.shares as string);
    if (!Number.isInteger(shares) && !buy?.halfSharesAllowed) {
      await this.mattermost.postEpemeralMessage(
        channelId,
        submission.user_id,
        "Share size cannot have a fraction if half shares are not allowed. Try again please"
      );
      return;
    }

    const interestId = await this.storageService.saveInterest(
      submission.channel_id,
      submission.user_id,
      submission.state as string,
      parseFloat(submission.submission.shares as string),
      submission.submission.email as string
    );

    await this.mattermost.postEpemeralMessage(
      submission.channel_id,
      submission.user_id,
      `You have marked your interest with ${submission.submission.shares} shares and email ${submission.submission.email}. Click 'Yes' again to edit your interest.`
    );
  }

  async showInterestList(post: MattermostPost) {
    const interests: InterestEntity[] =
      await this.storageService.getInterestsOfBuy(
        post.context.channel_id,
        post.context.buy_id
      );

    const usernameToInterest = await Promise.all(
      interests.map(async (interest) => {
        const user = await this.mattermost.getUser(interest.userId);
        return `|${user.username}|${interest.shares}|${interest.email}|${
          interest.payed ? "x" : ""
        }|`;
      })
    );

    await this.mattermost.postEpemeralMessage(
      post.channel_id,
      post.user_id,
      "|Username|Shares|Email|Payed|\n" +
        "|---|---|---|\n" +
        usernameToInterest.join("\n")
    );
  }

  async markPayed(post: MattermostPost) {
    const buyer = await this.mattermost.getUser(post.user_id);
    const buy = (await this.storageService.getBuyEntity(
      post.context.channel_id,
      post.context.buy_id
    ))!;
    const organizer = await this.mattermost.getUser(buy.creatorUserId);
    const interest = (await this.storageService.getInterestOfUser(
      post.context.channel_id,
      buy.buyId,
      buyer.id
    ))!;
    const confirmationRequest = this.createPaymentConfirmationMessage(
      interest,
      buy,
      buyer
    );

    await this.mattermost.sendDirectMessage(organizer.id, confirmationRequest);
    await this.mattermost.sendDirectMessage(
      buyer.id,
      new MessageBuilder()
        .text(
          "Thank you! The organizer will soon approve your payment. Stay tuned!"
        )
        .build()
    );
  }

  async confirmPayment(post: MattermostPost) {
    const interest = (await this.storageService.getInterestOfUser(
      post.context.channel_id,
      post.context.buy_id,
      post.context.user_id
    ))!;

    const buy = (await this.storageService.getBuyEntity(
      post.context.channel_id,
      post.context.buy_id
    ))!;

    interest.payed = true;

    await this.storageService.saveInterest(
      post.context.channel_id,
      post.user_id,
      post.context.buy_id,
      interest.shares,
      interest.email,
      interest.payed
    );

    await this.mattermost.sendDirectMessage(
      post.context.user_id,
      new MessageBuilder().text("Thank you for the confirmation.").build()
    );

    await this.mattermost.sendDirectMessage(
      post.context.user_id,
      new MessageBuilder()
        .text(
          `The organizer has confirmed your payment for the buy **${buy.name}**. 🎉 Thank you for your prompt payment! If you have any questions, feel free to reach out.`
        )
        .build()
    );

    await this.mattermost.removeBotReactions(post.post_id);
    await this.mattermost.addReaction(post.post_id, "white_check_mark");
  }

  async rejectPayment(post: MattermostPost) {
    const interest = (await this.storageService.getInterestOfUser(
      post.context.channel_id,
      post.context.buy_id,
      post.context.user_id
    ))!;

    interest.payed = false;

    await this.storageService.saveInterest(
      post.context.channel_id,
      post.user_id,
      post.context.buy_id,
      interest.shares,
      interest.email,
      interest.payed
    );

    const buyer = (await this.mattermost.getUser(post.context.user_id))!;

    await this.mattermost.sendDirectMessage(
      post.context.user_id,
      new MessageBuilder()
        .text(
          `The organizer rejected your payment status. Please check your payment and confirm again in case you payed or get in contact with the organizer @${buyer.username}`
        )
        .build()
    );

    await this.mattermost.sendDirectMessage(
      post.context.user_id,
      new MessageBuilder()
        .text(`Many thanks for the feedback. I informed the buyer.`)
        .build()
    );

    await this.mattermost.removeBotReactions(post.post_id);
    await this.mattermost.addReaction(post.post_id, "x");
  }

  private createConfirmationMessage(
    shares: string,
    email: string,
    interestId: string,
    userId: string,
    channelId: string
  ): Message {
    return new MessageBuilder()
      .text(
        `You have marked your interest with ${shares} shares and email ${email}`
      )
      .attachment((attachment) =>
        attachment
          .button("edit-interest", "Edit", `${process.env.BOT_URL}/interest`, {
            interest_id: interestId,
          })
          .text("Come back to edit in case you really need to")
          .build()
      )
      .channelId(channelId)
      .build();
  }

  private createInterestDialog(
    buy: BuyEntity,
    interest: InterestEntity | undefined
  ): Dialog {
    return new DialogBuilder("interest-dialog", "Mark your interest")
      .textElement({
        display_name: buy.halfSharesAllowed
          ? "Shares – insert valid numbers with . as decimal separator"
          : "Shares - only full shares allowed",
        name: "shares",
        optional: false,
        default: `${interest?.shares ?? 1}`,
        subtype: "text",
      })
      .textElement({
        display_name: "Email",
        name: "email",
        subtype: "email",
        optional: false,
        default: interest?.email ?? "",
      })
      .submitLabel("Submit")
      .notifyOnCancel(false)
      .state(buy.buyId)
      .build();
  }

  createPaymentConfirmationMessage(
    interest: InterestEntity,
    buy: BuyEntity,
    buyer: User
  ): Message {
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
              channel_id: interest.channelId,
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
              channel_id: interest.channelId,
              user_id: buyer.id,
              buy_id: buy.buyId,
            }
          )
          .build()
      )
      .build();
  }
}

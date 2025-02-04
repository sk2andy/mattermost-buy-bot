import * as dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
dotenv.config();

import { createBuyDialog } from "./buy/createBuy";
import {
  MattermostClient,
  MattermostDialogSubmission,
  MattermostSlashCommandRequest,
  MessageBuilder,
} from "./mattermost";
import {
  BuyEntity,
  createPaymentDetailsDialog,
  getBuyEntity,
  getInterestOfUser,
  getInterestsOfBuy,
  InterestEntity,
  saveBuyEntity,
  saveInterest,
} from "./storageService";
import express from "express";
import bodyParser from "body-parser";
import { MattermostPost } from "./mattermost/postAction";
import {
  createManageMessage,
  createSaveBuyConfirmationMessage,
} from "./buy/saveBuy";
import { createPaymentMessage } from "./buy/closeBuy";
import { createPaymentConfirmationMessage } from "./interest/markPayed";
import { createInterestDialog } from "./interest/createInterest";

const mattermost = new MattermostClient(
  process.env.MATTERMOST_URL!,
  process.env.MATTERMOST_TOKEN!,
  process.env.MATTERMOST_BOT_USER_ID!
);

console.log("Create server...");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
// app.post("/env", async function (req, res) {
//   res.json(process.env);
// });

app.post(
  "/createbuy",
  async function (req: express.Request, res: express.Response) {
    const command = req.body as MattermostSlashCommandRequest;
    const dialog = await createBuyDialog(
      command.trigger_id,
      command.channel_id
    );

    await mattermost.openDialog(
      command.trigger_id,
      dialog,
      `${process.env.BOT_URL}/save-buy`
    );

    res.status(200).send();
  }
);

app.post(
  "/save-buy",
  async function (req: express.Request, res: express.Response) {
    const submission = req.body as MattermostDialogSubmission;
    const stateData: { channel_id: string; buy_id: string } = JSON.parse(
      submission.state as string
    );
    const buyId = stateData.buy_id ?? uuidv4();
    const user = await mattermost.getUser(submission.user_id);
    await saveBuyEntity(
      submission.channel_id,
      submission.user_id,
      buyId,
      submission.submission.buy_name as string,
      submission.submission.unit_for_shares as "mg" | "ml" | "unit",
      submission.submission.share_size as number,
      submission.submission.price_per_share as number,
      submission.submission.buy_description as string
    );
    const reply = await createSaveBuyConfirmationMessage(
      submission,
      res,
      user.username,
      buyId
    );
    await mattermost.postMessage(stateData.channel_id, reply);

    const manageReply = createManageMessage(submission, buyId);
    await mattermost.sendDirectMessage(submission.user_id, manageReply);
    res.status(200).send();
  }
);

app.post(
  "/edit-buy",
  async function (req: express.Request, res: express.Response) {
    const command = req.body as MattermostPost;
    const buy = await getBuyEntity(
      command.context.channel_id,
      command.context.buy_id
    );
    if (
      await checkIfBuyIsClosed(
        command.context.channel_id,
        command.context.buy_id,
        command.user_id,
        res
      )
    ) {
      return;
    }
    const dialog = await createBuyDialog(
      command.trigger_id,
      command.context.channel_id,
      command.context.buy_id
    );
    await mattermost.openDialog(
      command.trigger_id,
      dialog,
      `${process.env.BOT_URL}/save-buy`
    );
    res.status(200).send();
  }
);

app.post(
  "/close-buy",
  async function (req: express.Request, res: express.Response) {
    const post = req.body as MattermostPost;
    if (
      await checkIfBuyIsClosed(
        post.context.channel_id,
        post.context.buy_id,
        post.user_id,
        res
      )
    ) {
      return;
    }
    const dialog = createPaymentDetailsDialog(
      post.context.channel_id,
      post.context.buy_id
    );

    await mattermost.openDialog(
      post.trigger_id,
      dialog,
      `${process.env.BOT_URL}/close-buy-confirm`
    );

    res.status(200).send();
  }
);

app.post(
  "/close-buy-confirm",
  async function (req: express.Request, res: express.Response) {
    const submission = req.body as MattermostDialogSubmission;
    const stateData: { channel_id: string; buy_id: string } = JSON.parse(
      submission.state.toLowerCase()
    );
    const buy: BuyEntity = (await getBuyEntity(
      stateData.channel_id,
      stateData.buy_id
    ))!;
    buy.paypal = submission.submission.paypal as string;
    buy.usdcWallet = submission.submission.usdc_wallet as string;
    buy.wiseId = submission.submission.wise_id as string;
    buy.closed = true;
    buy.closedAt = new Date();
    await saveBuyEntity(
      stateData.channel_id,
      buy.creatorUserId,
      stateData.buy_id,
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
    await mattermost.postMessage(
      stateData.channel_id,
      new MessageBuilder()
        .text(
          `Buy **${buy?.name}** is closed now. You will receive individual payment messages.`
        )
        .channelId(stateData.channel_id)
        .build()
    );

    const interestsOfBuy = await getInterestsOfBuy(
      stateData.channel_id,
      stateData.buy_id
    );

    for (const interest of interestsOfBuy) {
      const paymentMessage = createPaymentMessage(buy, interest);
      await mattermost.sendDirectMessage(interest.userId, paymentMessage);
    }

    res.status(200).send();
  }
);

app.post(
  "/interest",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;
    if (
      await checkIfBuyIsClosed(
        message.context.channel_id,
        message.context.buy_id,
        message.user_id,
        res
      )
    ) {
      return;
    }
    const dialog = await createInterestDialog(message);
    await mattermost.openDialog(
      message.trigger_id,
      dialog,
      `${process.env.BOT_URL}/save-interest`
    );

    res.status(200).send();
  }
);

app.post(
  "/save-interest",
  async function (req: express.Request, res: express.Response) {
    const submission = req.body as MattermostDialogSubmission;

    if (
      await checkIfBuyIsClosed(
        submission.channel_id,
        submission.state,
        submission.user_id,
        res
      )
    ) {
      return;
    }

    const interestId = await saveInterest(
      submission.channel_id,
      submission.user_id,
      submission.state as string,
      parseInt(submission.submission.shares as string, 10),
      submission.submission.email as string
    );

    await mattermost.postEpemeralMessage(
      submission.channel_id,
      submission.user_id,
      `You have marked your interest with${submission.submission.shares} shares and email ${submission.submission.email}. Click 'Yes' again to edit your interest.`
    );

    res.json({ text: "Answered" });
  }
);

app.post(
  "/interestlist",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;
    const interests: InterestEntity[] = await getInterestsOfBuy(
      message.context.channel_id,
      message.context.buy_id
    );

    const usernameToInterest = await Promise.all(
      interests.map(async (interest) => {
        const user = await mattermost.getUser(interest.userId);
        return `|${user.username}|${interest.shares}|${interest.email}|${
          interest.payed ? "x" : ""
        }|`;
      })
    );

    await mattermost.postEpemeralMessage(
      message.channel_id,
      message.user_id,
      "|Username|Shares|Email|Payed|\n" +
        "|---|---|---|\n" +
        usernameToInterest.join("\n")
    );
    res.json({ text: "Opened dialog" });
  }
);

app.post(
  "/mark-payed",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;
    const buyer = await mattermost.getUser(message.user_id);
    const buy = (await getBuyEntity(
      message.context.channel_id,
      message.context.buy_id
    ))!;
    const organizer = await mattermost.getUser(buy.creatorUserId);

    const confirmationRequest = await createPaymentConfirmationMessage(
      message.context.channel_id,
      buy,
      buyer
    );

    await mattermost.sendDirectMessage(organizer.id, confirmationRequest);
    await mattermost.sendDirectMessage(
      buyer.id,
      new MessageBuilder()
        .text(
          "Thank you! The organizer will soon approve your payment. Stay tuned!"
        )
        .build()
    );

    res.status(200).send();
  }
);

app.post(
  "/confirm-payment",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;
    const interest = (await getInterestOfUser(
      message.context.channel_id,
      message.context.buy_id,
      message.context.user_id
    ))!;

    const buy = (await getBuyEntity(
      message.context.channel_id,
      message.context.buy_id
    ))!;

    interest.payed = true;

    await saveInterest(
      message.context.channel_id,
      message.user_id,
      message.context.buy_id,
      interest.shares,
      interest.email,
      interest.payed
    );

    await mattermost.sendDirectMessage(
      message.context.user_id,
      new MessageBuilder().text("Thank you for the confirmation.").build()
    );

    await mattermost.sendDirectMessage(
      message.context.user_id,
      new MessageBuilder()
        .text(
          `The organizer has confirmed your payment for the buy **${buy.name}**. 🎉 Thank you for your prompt payment! If you have any questions, feel free to reach out.`
        )
        .build()
    );

    await mattermost.removeBotReactions(message.post_id);
    await mattermost.addReaction(message.post_id, "white_check_mark");

    res.status(200).send();
  }
);

app.post(
  "/reject-payment",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;
    const interest = (await getInterestOfUser(
      message.context.channel_id,
      message.context.buy_id,
      message.context.user_id
    ))!;

    interest.payed = false;

    await saveInterest(
      message.context.channel_id,
      message.user_id,
      message.context.buy_id,
      interest.shares,
      interest.email,
      interest.payed
    );

    const buyer = (await mattermost.getUser(message.context.user_id))!;

    await mattermost.sendDirectMessage(
      message.context.user_id,
      new MessageBuilder()
        .text(
          `The organizer rejected your payment status. Please check your payment and confirm again in case you payed or get in contact with the organizer @${buyer.username}`
        )
        .build()
    );

    await mattermost.sendDirectMessage(
      message.context.user_id,
      new MessageBuilder()
        .text(`Many thanks for the feedback. I informed the buyer.`)
        .build()
    );

    await mattermost.removeBotReactions(message.post_id);
    await mattermost.addReaction(message.post_id, "x");

    res.status(200).send();
  }
);

app.post(
  "/remind-payment",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;
    const interests = await getInterestsOfBuy(
      message.context.channel_id,
      message.context.buy_id
    );

    for (const interest of interests) {
      if (!interest.payed) {
        const user = await mattermost.getUser(interest.userId);
        await mattermost.sendDirectMessage(
          user.id,
          new MessageBuilder()
            .text(`Please pay for the buy **${message.context.buy_name}**`)
            .build()
        );
      }
    }

    res.json({ text: "Reminders sent" });
  }
);

console.log("listen on 8585...");
app.listen(8585, function () {
  console.log("Example app listening on port 8585!");
});

async function checkIfBuyIsClosed(
  channelId: string,
  buyId: string,
  userId: string,
  res: express.Response
) {
  const buy = await getBuyEntity(channelId, buyId);

  if (buy?.closed) {
    await mattermost.postEpemeralMessage(
      channelId,
      userId,
      "Buy is already closed. You can't edit it."
    );
    res.status(200).send();
    return true;
  }
  return false;
}

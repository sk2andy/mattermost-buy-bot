import {
  MattermostDialogSubmission,
  Message,
  MessageBuilder,
} from "../mattermost";
import express from "express";

export async function createSaveBuyConfirmationMessage(
  submission: MattermostDialogSubmission,
  res: express.Response,
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

export function createManageMessage(
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

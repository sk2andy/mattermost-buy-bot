import { Dialog, DialogBuilder, Message, MessageBuilder } from "../mattermost";
import { MattermostPost } from "../mattermost/postAction";
import { getInterestOfUser } from "../storageService";

export async function createInterestDialog(
  message: MattermostPost
): Promise<Dialog> {
  const entity = await getInterestOfUser(
    message.channel_id,
    message.context?.buy_id,
    message.user_id
  );

  return new DialogBuilder("interest-dialog", "Mark your interest")
    .textElement({
      display_name: "Shares",
      name: "shares",
      optional: false,
      default: `${entity?.shares ?? 1}`,
      subtype: "number",
    })
    .textElement({
      display_name: "Email",
      name: "email",
      subtype: "email",
      optional: false,
      default: entity?.email ?? "",
    })
    .submitLabel("Submit")
    .notifyOnCancel(false)
    .state(message.context?.buy_id)
    .build();
}

export function createConfirmationMessage(
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

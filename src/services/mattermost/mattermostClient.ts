import { url } from "inspector";
import { Dialog } from "./dialogBuilder";
import { Message } from "./messageBuilder";
import { User } from "./user";
import { singleton } from "tsyringe";

@singleton()
export class MattermostClient {
  private baseUrl: string;
  private token: string;
  private botUserId: string;

  constructor() {
    const serverUrl = process.env.MATTERMOST_URL!;
    this.baseUrl = serverUrl!.endsWith("/")
      ? serverUrl.slice(0, -1)
      : serverUrl;
    this.token = process.env.MATTERMOST_TOKEN!;
    this.botUserId = process.env.MATTERMOST_BOT_USER_ID!;
  }

  private async request(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<any> {
    console.log("body", JSON.stringify(body));
    const url = `${this.baseUrl}/api/v4${endpoint}`;
    console.log("endpoint", url);
    const headers = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      console.log("response", await response.json());
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async postMessage(channelId: string, message: Message): Promise<any> {
    return this.request("POST", "/posts", {
      channel_id: channelId,
      message: message.text,
      props: {
        ...message.props,
        attachments: message.attachments,
        text: undefined,
        pretext: undefined,
      },
    });
  }

  async postEpemeralMessage(
    channelId: string,
    userId: string,
    message: string
  ): Promise<any> {
    return this.request("POST", "/posts/ephemeral", {
      user_id: userId,
      post: {
        channel_id: channelId,
        message,
      },
    });
  }

  async openDialog(
    triggerId: string,
    dialog: Dialog,
    targetUrl: string
  ): Promise<any> {
    console.log(
      "abc",
      JSON.stringify({
        trigger_id: triggerId,
        url: targetUrl,
        dialog,
      })
    );
    return this.request("POST", "/actions/dialogs/open", {
      trigger_id: triggerId,
      url: targetUrl,
      dialog,
    });
  }

  async respondToSlashCommand(
    responseUrl: string,
    message: Message
  ): Promise<any> {
    const headers = {
      "Content-Type": "application/json",
    };

    const response = await fetch(responseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.log("response", response.json());
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getUser(userId: string): Promise<User> {
    return this.request("GET", `/users/${userId}`);
  }

  async sendDirectMessage(userId: string, message: Message): Promise<any> {
    const directChannel = await this.request("POST", "/channels/direct", [
      userId,
      this.botUserId,
    ]);
    const channelId = directChannel.id;

    return this.postMessage(channelId, message);
  }

  async addReaction(postId: string, emojiName: string): Promise<any> {
    return this.request("POST", "/reactions", {
      user_id: this.botUserId,
      post_id: postId,
      emoji_name: emojiName,
    });
  }

  async removeBotReactions(postId: string): Promise<any> {
    const reactions = await this.request("GET", `/posts/${postId}/reactions`);
    const botReactions =
      reactions?.filter(
        (reaction: any) => reaction.user_id === this.botUserId
      ) ?? [];

    const promises = botReactions.map((reaction: any) =>
      this.request(
        "DELETE",
        `/users/${this.botUserId}/posts/${postId}/reactions/${reaction.emoji_name}`
      )
    );

    return Promise.all(promises);
  }
}

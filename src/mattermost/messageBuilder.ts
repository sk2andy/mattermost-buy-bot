import { MattermostDialogSubmission } from "./dialogSubmission";
import { MattermostPost } from "./postAction";

type MarkdownText = string;

export interface Message {
  text?: MarkdownText;
  attachments?: Attachment[];
  props?: Record<string, any>;
}

interface Attachment {
  fallback?: string;
  color?: string;
  pretext?: MarkdownText;
  text?: MarkdownText;
  title?: string;
  title_link?: string;
  fields?: Field[];
  image_url?: string;
  thumb_url?: string;
  actions?: Action[];
}

interface Field {
  title: string;
  value: string;
  short: boolean;
}

type Action = ButtonAction | MenuAction;

interface ButtonAction {
  id: string;
  name: string;
  integration: {
    url: string;
    context: Record<string, any>;
  };
  style?: "primary" | "success" | "danger" | "default";
  type: "button";
}

interface MenuAction {
  id: string;
  name: string;
  integration: {
    url: string;
    context: Record<string, any>;
  };
  data_source: "users" | "channels" | "options";
  type: "select";
  options?: { text: string; value: string }[];
}

interface MattermostSlashCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

export class MessageBuilder {
  private message: Message = {};

  text(text: MarkdownText): this {
    this.message.text = text;
    return this;
  }

  attachment(callback: (builder: AttachmentBuilder) => void): this {
    const builder = new AttachmentBuilder();
    callback(builder);
    this.message.attachments = [
      ...(this.message.attachments || []),
      builder.build(),
    ];
    return this;
  }

  prop(key: string, value: any): this {
    this.message.props = { ...this.message.props, [key]: value };
    return this;
  }

  channelId(channelId: string): this {
    this.message.props = { ...this.message.props, channel_id: channelId };
    return this;
  }

  userId(userId: string): this {
    this.message.props = { ...this.message.props, user_id: userId };
    return this;
  }

  teamId(teamId: string): this {
    this.message.props = { ...this.message.props, team_id: teamId };
    return this;
  }

  fromPayload(
    payload: MattermostSlashCommandPayload | MattermostDialogSubmission
  ): this {
    this.message.props = {
      ...this.message.props,
      token: (payload as MattermostSlashCommandPayload)?.token,
      channel_id: payload.channel_id,
      user_id: payload.user_id,
      team_id: payload.team_id,
      team_domain: (payload as MattermostSlashCommandPayload)?.team_domain,
      channel_name: (payload as MattermostSlashCommandPayload)?.channel_name,
      user_name: (payload as MattermostSlashCommandPayload)?.user_name,
      response_url: (payload as MattermostSlashCommandPayload)?.response_url,
      trigger_id: (payload as MattermostSlashCommandPayload)?.trigger_id,
    };
    return this;
  }

  build(): Message {
    return {
      ...this.message,
      props: { ...this.message.props, user_id: this.message.props?.user_id },
    };
  }
}

export class AttachmentBuilder {
  private attachment: Attachment = {};

  pretext(text: MarkdownText): this {
    this.attachment.pretext = text;
    return this;
  }

  text(text: MarkdownText): this {
    this.attachment.text = text;
    return this;
  }

  color(hexColor: string): this {
    this.attachment.color = hexColor;
    return this;
  }

  field(title: string, value: string, short = false): this {
    this.attachment.fields = [
      ...(this.attachment.fields || []),
      { title, value, short },
    ];
    return this;
  }

  button(
    id: string,
    name: string,
    url: string,
    context: object = {},
    style?: ButtonAction["style"]
  ): this {
    const action: ButtonAction = {
      id,
      name,
      integration: { url, context },
      type: "button",
      style,
    };
    this.attachment.actions = [...(this.attachment.actions || []), action];
    return this;
  }

  menu(
    id: string,
    name: string,
    dataSource: MenuAction["data_source"],
    url: string,
    context: object = {}
  ): this {
    const action: MenuAction = {
      id,
      name,
      integration: { url, context },
      data_source: dataSource,
      type: "select",
    };
    this.attachment.actions = [...(this.attachment.actions || []), action];
    return this;
  }

  image(url: string): this {
    this.attachment.image_url = url;
    return this;
  }

  build(): Attachment {
    return { ...this.attachment };
  }
}

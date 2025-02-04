interface MattermostPostAction {
  id: string;
  name: string;
  type: string;
}

interface MattermostPostActionIntegration {
  url: string;
  context: Record<string, any>;
}

export interface MattermostPost {
  post_id: string;
  create_at: number;
  update_at: number;
  edit_at: number;
  delete_at: number;
  is_pinned: boolean;
  user_id: string;
  channel_id: string;
  trigger_id: string;
  context: Record<string, any>;
  root_id: string;
  parent_id: string;
  original_id: string;
  message: string;
  type: string;
  props: Record<string, any>;
  hashtags: string;
  pending_post_id: string;
  metadata: Record<string, any>;
}

interface MattermostInteractiveMessageAction {
  user_id: string;
  post_id: string;
  channel_id: string;
  team_id: string;
  action_id: string;
  trigger_id: string;
  data_source: string;
  type: string;
  context: Record<string, any>;
  selected_option?: string;
  cookie?: string;
}

interface MattermostInteractiveMessageContext {
  app_id: string;
  bot_user_id: string;
  bot_access_token?: string;
  acting_user_id: string;
  user_id: string;
  channel_id: string;
  team_id: string;
  user_name?: string;
  channel_name?: string;
  team_name?: string;
  post_id: string;
  root_id?: string;
}

interface MattermostInteractiveMessagePayload {
  type: "interactive_message";
  actions: MattermostInteractiveMessageAction[];
  context: MattermostInteractiveMessageContext;
  post: MattermostPost;
}

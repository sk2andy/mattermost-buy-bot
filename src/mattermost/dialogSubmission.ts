export interface MattermostDialogSubmission {
  type: "dialog_submission";
  callback_id: string;
  state: string;
  user_id: string;
  channel_id: string;
  team_id: string;
  submission: Record<string, string | number | boolean>;
  cancelled: boolean;
}

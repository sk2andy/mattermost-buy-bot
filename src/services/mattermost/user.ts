export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nickname: string;
  position: string;
  locale: string;
  timezone: string;
  is_bot: boolean;
  last_picture_update: number;
  last_name_update: number;
  last_password_update: number;
  failed_attempts: number;
  mfa_active: boolean;
  email_verified: boolean;
  auth_service: string;
  auth_data: string;
  notify_props: Record<string, any>;
  props: Record<string, any>;
  update_at: number;
  create_at: number;
  delete_at: number;
  is_active: boolean;
  is_guest: boolean;
  is_system: boolean;
  roles: string;
}

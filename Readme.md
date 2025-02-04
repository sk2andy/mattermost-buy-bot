# Mattermost Buy Bot

## Setup Instructions

### Environment Variables

Create a `.env` file in the root directory of your project and set the following variables:

```
AZURE_STORAGE_ACCOUNT_NAME=<your_azure_storage_account_name>
AZURE_STORAGE_ACCOUNT_KEY=<your_azure_storage_account_key>
MATTERMOST_URL=<your_mattermost_url>
MATTERMOST_TOKEN=<your_bot_access_token>
MATTERMOST_BOT_USER_ID=<your_bot_userid>
BOT_URL=<endpoint_of_this_bot>
```

### Mattermost Configuration

1. **Create a Bot Account:**

   - Go to **System Console** > **Integrations** > **Bot Accounts**.
   - Click **Add Bot Account**.
   - Fill in the required details and save the bot account.
   - Copy the **Access Token** and set it in your `.env` file as `MATTERMOST_TOKEN`.

2. **Create a Slash Command:**
   - Go to **Main Menu** > **Integrations** > **Slash Commands**.
   - Click **Add Slash Command**.
   - Fill in the following details:
     - **Title:** Create Buy
     - **Command Trigger Word:** createbuy
     - **Request URL:** `<your_server_url>/createbuy`
     - **Response Username:** `<your_bot_username>`
   - Save the slash command.

### Running the Bot

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Start the bot:
   ```bash
   npx ts-node ./src/index.ts
   ```

Your Mattermost Buy Bot should now be up and running!

# openclaw-dingtalk

DingTalk channel plugin for OpenClaw with Stream mode support.

## Requirements

- OpenClaw >= 2026.1.29
- Node.js >= 18

## Install

From npm:

```bash
openclaw plugins install @wulien/openclaw-dingtalk
```

From local path (for development):

```bash
openclaw plugins install /path/to/openclaw-dingtalk
```

## Integrate with OpenClaw

1) Create a DingTalk internal app
- In the DingTalk developer console, create an internal app.
- Enable the bot capability and Stream mode.
- Copy the AppKey (clientId) and AppSecret (clientSecret).
- If you want proactive single chat send, also copy the robotCode.

2) Configure OpenClaw

Minimal config:

```yaml
channels:
  dingtalk:
    enabled: true
    clientId: "your_app_key"
    clientSecret: "your_app_secret"
```

Optional config:

```yaml
channels:
  dingtalk:
    enabled: true
    clientId: "your_app_key"
    clientSecret: "your_app_secret"
    robotCode: "your_robot_code"   # required for proactive single chat send
    dm:
      policy: pairing               # open | pairing | allowlist
      allowFrom: []
    groupPolicy: allowlist          # open | allowlist | disabled
    groups:
      "group_conversation_id":
        enabled: true
        requireMention: false
        toolPolicy: "default"
```

You can also set config via CLI (examples):

```bash
openclaw config set channels.dingtalk.clientId "your_app_key"
openclaw config set channels.dingtalk.clientSecret "your_app_secret"
openclaw config set channels.dingtalk.enabled true
```

3) Start OpenClaw gateway

```bash
openclaw gateway --verbose
```

4) Validate
- Send a message to the DingTalk bot.
- The plugin should receive it via Stream mode and respond through OpenClaw.

## Standalone connectivity test (no OpenClaw)

Use the standalone script to validate Stream mode connectivity first.

```bash
set DINGTALK_CLIENT_ID=your_app_key
set DINGTALK_CLIENT_SECRET=your_app_secret
node test-dingtalk-standalone.mjs
```

If you are on PowerShell:

```powershell
$env:DINGTALK_CLIENT_ID="your_app_key"
$env:DINGTALK_CLIENT_SECRET="your_app_secret"
node test-dingtalk-standalone.mjs
```

Send a message to the bot. You should see the incoming message logged and an echo reply.

## Standalone single-chat send test

Use this script to verify proactive single-chat sending (robotCode required).

```powershell
$env:DINGTALK_CLIENT_ID="your_app_key"
$env:DINGTALK_CLIENT_SECRET="your_app_secret"
$env:DINGTALK_ROBOT_CODE="your_robot_code"
$env:DINGTALK_USER_ID="target_user_id"
node test-dingtalk-send-single.mjs
```

You can override the message content:

```powershell
$env:DINGTALK_TEXT="hello"
node test-dingtalk-send-single.mjs
```

## Configuration Reference

- enabled: boolean, enable/disable the channel
- clientId: string, DingTalk AppKey
- clientSecret: string, DingTalk AppSecret
- robotCode: string, required for proactive single chat send
- dm.policy: open | pairing | allowlist
- dm.allowFrom: list of user IDs for allowlist mode
- groupPolicy: open | allowlist | disabled
- groups.<conversationId>.enabled: boolean
- groups.<conversationId>.requireMention: boolean
- groups.<conversationId>.toolPolicy: string

## Pairing and Allowlist

- pairing (default): OpenClaw will gate new users; approve them before replying.
- open: allow any DM to trigger without approval.
- allowlist: only users in dm.allowFrom can trigger.

## Multi-account Example

```yaml
channels:
  dingtalk:
    accounts:
      work:
        enabled: true
        name: "Work Bot"
        clientId: "work_app_key"
        clientSecret: "work_app_secret"
        robotCode: "work_robot_code"
        dm:
          policy: pairing
          allowFrom: []
        groupPolicy: open
      personal:
        enabled: true
        name: "Personal Bot"
        clientId: "personal_app_key"
        clientSecret: "personal_app_secret"
        robotCode: "personal_robot_code"
        dm:
          policy: open
        groupPolicy: allowlist
        groups:
          "personal_group_id":
            enabled: true
            requireMention: false
```

## Features

- Stream mode inbound messages (no public webhook required)
- DM and group chat support
- Pairing flow support
- Direct outbound messages via robotCode

## Development

```bash
pnpm install
pnpm run typecheck
```

## Notes

- Stream mode uses a reverse WebSocket connection, so no public HTTP server is needed.
- Ensure the DingTalk app has permission to receive and send messages.
- Proactive outbound messages require robotCode.

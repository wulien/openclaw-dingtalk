# openclaw-dingtalk

DingTalk channel plugin for OpenClaw with Stream mode support.

## Install

```bash
openclaw plugins install @wulien/openclaw-dingtalk
```

## Configure

Minimal config:

```yaml
channels:
  dingtalk:
    enabled: true
    clientId: "your_app_key"
    clientSecret: "your_app_secret"
```

Optional fields:

```yaml
channels:
  dingtalk:
    enabled: true
    clientId: "your_app_key"
    clientSecret: "your_app_secret"
    robotCode: "your_robot_code"   # optional, required for proactive single chat send
    dm:
      policy: pairing               # open | pairing | allowlist
      allowFrom: []
    groupPolicy: allowlist          # open | allowlist
    groups:
      "group_conversation_id":
        enabled: true
        requireMention: false
        toolPolicy: "default"
```

## Features

- Stream mode inbound messages (no public webhook required)
- DM and group chat support
- Pairing flow support
- Direct outbound messages via robotCode

## Development

```bash
pnpm install
pnpm exec tsc -p tsconfig.json --noEmit
```

## Notes

- Create a DingTalk internal app and enable Stream mode.
- Ensure the bot has permission to receive and send messages.

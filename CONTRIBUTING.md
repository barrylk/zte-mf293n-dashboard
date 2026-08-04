# Contributing

Thanks for helping Beacon support more routers.

## Adding a router model

Open an issue or pull request containing:

- Manufacturer and exact model number
- Hardware revision and complete firmware version
- Whether the router is carrier-branded or unlocked
- Read-only examples of its authentication and status responses with passwords, tokens, public IP addresses, IMEI values, phone numbers, and message contents removed
- A list of commands that were verified through the router's own interface files
- A description of every write action and its expected connectivity impact

Keep model-specific command names and response parsing isolated so existing MF293N behavior does not regress. Prefer an adapter or capability map over scattered model checks.

## Safety requirements

- Never commit router credentials, session tokens, IMEI values, phone numbers, SMS content, or carrier account data.
- Do not execute firmware flashing, factory reset, NV-memory writes, arbitrary shell commands, or undocumented modem commands as part of development or testing.
- Every state-changing endpoint must require explicit confirmation.
- Validate values server-side using an allowlist where practical.
- Mark unsupported capabilities honestly instead of simulating data or guessing endpoints.
- Test read paths first. Describe any live mutation performed during testing in the pull request.

## Before submitting

```bash
npm install
npm run build
npm run lint
```

Include screenshots when the interface changes, but redact personal device names, addresses, phone numbers, message contents, and other identifiers where necessary.

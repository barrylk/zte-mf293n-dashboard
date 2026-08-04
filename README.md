# Beacon — ZTE MF293N Router Dashboard

A modern, local-first web interface for the ZTE MF293N LTE router. Beacon talks directly to the router's verified `goform` interface and presents live network data, connected clients, SMS, USSD, radio controls, Wi-Fi settings, and maintenance actions in one responsive dashboard.

> [!IMPORTANT]
> Run Beacon only on a trusted local network. It is designed to control a router at a private address such as `192.168.1.1`; do not expose this application directly to the public internet.

## Screenshots

### Live router overview

![Beacon router overview](docs/screenshots/overview.png)

### Wi-Fi and Ethernet clients

![Beacon connected devices](docs/screenshots/devices.png)

## Features

- Router login using the MF293N SHA-256 challenge flow
- HTTP-only, in-memory dashboard sessions; router passwords are never committed or returned to the browser
- Live carrier, connection, signal, throughput, traffic, firmware, and device information
- Separate Wi-Fi and Ethernet client discovery with hostname, IP address, and MAC address
- Wi-Fi SSID, password, coverage, and client-limit controls
- Device rename, block, and unblock controls
- APN profile editing and cellular reconnect
- Full stored SMS inbox, SMS sending, read state, and deletion
- Interactive USSD requests, replies, and cancellation
- LTE band locking for firmware-exposed bands 3, 5, 38, and 41
- Live serving-cell band, EARFCN/channel, PCI, Cell ID, RSRP, RSRQ, and SINR
- OTA check, traffic-counter reset, and router restart
- Confirmation dialogs for state-changing or service-interrupting actions

## Supported device

Developed and verified against ZTE MF293N hardware `MF293NHW1.0` and firmware family `BD_MF293NV1.0.0B03`.

Other ZTE devices may use similar endpoints, but command names and authentication behavior vary. Treat other models as unsupported until their interface has been verified.

The inspected MF293N firmware exposes LTE band locking and serving-cell information, but no verified PCI/EARFCN cell-lock command. Beacon reports cell identity without issuing speculative modem commands.

## Add support for another router

Contributions for other ZTE and compatible LTE/5G routers are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. New device support should use a clearly identified adapter, document the tested model and firmware, preserve confirmation guards, and avoid speculative write commands.

## Requirements

- Node.js 22.13 or newer
- npm
- A computer connected to the MF293N by Wi-Fi or Ethernet
- Router administrator credentials

## Run locally

```bash
git clone https://github.com/barrylk/zte-mf293n-dashboard.git
cd zte-mf293n-dashboard
npm install
npm run dev
```

Open the local URL printed by the development server, normally `http://localhost:3000`, then sign in using the router address and administrator credentials.

For a production-mode local build:

```bash
npm run build
npm start
```

## Security model

- Credentials are retained only in local server memory for the active session.
- The browser receives an HTTP-only, `SameSite=Strict` session cookie—not the router password.
- Router addresses are restricted to localhost and RFC 1918 private-network ranges.
- No `.env` file or default password is required.
- Every mutation endpoint checks an explicit confirmation flag.
- SMS and USSD actions may incur carrier charges or alter carrier services.
- Band, APN, Wi-Fi, reconnect, and restart actions can temporarily interrupt connectivity.

Restarting Beacon clears every in-memory session.

## Project structure

```text
app/
  api/router/       Authentication, status, communication, radio, and control APIs
  page.tsx          Dashboard interface and controls
  globals.css       Responsive visual design
build/              Sites-compatible Vite packaging helper
worker/             Cloudflare/vinext worker entry point
```

## Development

```bash
npm run build
npm run lint
```

The application uses React, Next.js-compatible routing through vinext, Vite, and a Cloudflare Worker-compatible server build.

## Disclaimer

This independent community project is not affiliated with or endorsed by ZTE or any mobile carrier. Back up router settings before making changes. You are responsible for carrier charges, connectivity interruptions, and compliance with local radio and telecommunications rules.

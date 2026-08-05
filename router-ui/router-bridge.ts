type Json = Record<string, unknown>;
type Credentials = { username: string; password: string };

const nativeFetch = window.fetch.bind(window);
const masks: Record<string, string> = {
  "3": "0x000000004",
  "5": "0x000000010",
  "38": "0x2000000000",
  "41": "0x10000000000",
};
const trafficCommands = [
  "tc_traffic_enable",
  "upload_width_manual",
  "download_width_manual",
  ...Array.from({ length: 10 }, (_, index) => `userspeedlimit_${index}`),
].join(",");
const statusCommands = [
  "loginfo",
  "signalbar",
  "network_type",
  "network_provider",
  "ppp_status",
  "SSID1",
  "station_mac",
  "realtime_tx_thrpt",
  "realtime_rx_thrpt",
  "realtime_tx_bytes",
  "realtime_rx_bytes",
  "realtime_time",
  "monthly_rx_bytes",
  "monthly_tx_bytes",
  "wifi_coverage",
  "lan_ipaddr",
  "wan_ipaddr",
  "wa_inner_version",
  "cr_version",
  "hardware_version",
  "web_version",
  "imei",
  "lte_rsrp",
  "lte_rsrq",
  "lte_snr",
  "lte_rssi",
  "lte_pci",
  "cell_id",
  "wan_active_band",
  "wan_active_channel",
  "lte_rsrp_1",
  "lte_rsrp_2",
  "lte_rsrp_3",
  "lte_rsrp_4",
  "lte_snr_1",
  "lte_snr_2",
  "lte_snr_3",
  "lte_snr_4",
  "battery_exist",
  "battery_value",
  "battery_temp",
  "battery_charging",
  "mode_main_state",
  "tx_power",
  "MAX_Access_num",
  "AuthMode",
  "sms_unread_num",
  "ACL_mode",
  "wifi_mac_black_list",
  "wifi_hostname_black_list",
  "user_ip_addr",
  "apn_interface_version",
  "profile_name_ui",
  "m_profile_name",
  "profile_name",
  "wan_apn_ui",
  "wan_apn",
  "ppp_auth_mode_ui",
  "ppp_auth_mode",
  "ppp_username_ui",
  "ppp_username",
  "Current_index",
  "apn_mode",
  "WirelessMode",
  "CountryCode",
  "Channel",
  "HT_MCS",
  "wifi_11n_cap",
  "wifi_band",
].join(",");

let credentials: Credentials | null = null;

function json(data: Json, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
function value(input: unknown) {
  return input == null ? "" : String(input);
}
function numeric(input: unknown) {
  const number = Number(input);
  return Number.isFinite(number) ? number : 0;
}
function text(input: unknown, max = 512) {
  return value(input).trim().slice(0, max);
}
function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function initials(name: string) {
  return (
    name
      .split(/[\s-_]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2) || "DV"
  ).toUpperCase();
}
function base64(input: string) {
  return btoa(unescape(encodeURIComponent(input)));
}
function selectedBands(maskValue: unknown) {
  const parts = value(maskValue).split(";").filter(Boolean);
  const combined =
    parts.length > 1
      ? parts.reduce((sum, part) => sum + (Number.parseInt(part, 16) || 0), 0)
      : Number.parseInt(parts[0] || "0", 16) || 0;
  return Object.entries(masks)
    .filter(
      ([, mask]) => Math.floor(combined / Number.parseInt(mask, 16)) % 2 === 1,
    )
    .map(([band]) => band);
}
function validIpv4(input: string) {
  const parts = input.split(".");
  return (
    parts.length === 4 &&
    parts.every(
      (part) =>
        /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255,
    )
  );
}

async function sha256(input: string) {
  const source = unescape(encodeURIComponent(input.replace(/\r\n/g, "\n")));
  const words: number[] = [];
  const bitLength = source.length * 8;
  for (let index = 0; index < source.length; index++) {
    words[index >> 2] =
      (words[index >> 2] || 0) |
      (source.charCodeAt(index) << (24 - (index % 4) * 8));
  }
  words[bitLength >> 5] =
    (words[bitLength >> 5] || 0) | (0x80 << (24 - (bitLength % 32)));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const rotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  for (let offset = 0; offset < words.length; offset += 16) {
    const schedule = new Array<number>(64);
    for (let index = 0; index < 16; index++)
      schedule[index] = words[offset + index] || 0;
    for (let index = 16; index < 64; index++) {
      const s0 =
        rotate(schedule[index - 15], 7) ^
        rotate(schedule[index - 15], 18) ^
        (schedule[index - 15] >>> 3);
      const s1 =
        rotate(schedule[index - 2], 17) ^
        rotate(schedule[index - 2], 19) ^
        (schedule[index - 2] >>> 10);
      schedule[index] =
        (schedule[index - 16] + s0 + schedule[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index++) {
      const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 =
        (h + sum1 + choice + constants[index] + schedule[index]) >>> 0;
      const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("")
    .toUpperCase();
}

function md5(input: string) {
  const bytes = Array.from(new TextEncoder().encode(input));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++)
    bytes.push(Math.floor(bitLength / 2 ** (8 * i)) & 0xff);
  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
    16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21,
  ];
  const constants = Array.from(
    { length: 64 },
    (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0,
  );
  let a0 = 0x67452301,
    b0 = 0xefcdab89,
    c0 = 0x98badcfe,
    d0 = 0x10325476;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from(
      { length: 16 },
      (_, i) =>
        (bytes[offset + i * 4] |
          (bytes[offset + i * 4 + 1] << 8) |
          (bytes[offset + i * 4 + 2] << 16) |
          (bytes[offset + i * 4 + 3] << 24)) >>>
        0,
    );
    let a = a0,
      b = b0,
      c = c0,
      d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const sum = (a + f + constants[i] + words[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << shifts[i]) | (sum >>> (32 - shifts[i])))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0]
    .map((word) =>
      [0, 8, 16, 24]
        .map((shift) => ((word >>> shift) & 255).toString(16).padStart(2, "0"))
        .join(""),
    )
    .join("");
}

async function getParams(values: Record<string, string>) {
  const query = new URLSearchParams({
    isTest: "false",
    ...values,
    _: Date.now().toString(),
  });
  const response = await nativeFetch(
    `/goform/goform_get_cmd_process?${query}`,
    {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Router returned ${response.status}`);
  return response.json() as Promise<Json>;
}
function get(cmd: string) {
  return getParams({ cmd, multi_data: "1" });
}

async function login(user: string, password: string) {
  const salt = value((await get("LD")).LD);
  const encoded = await sha256(`${await sha256(password)}${salt}`);
  const body = new URLSearchParams({
    isTest: "false",
    goformId: "LOGIN_MULTI_USER",
    password: encoded,
    user,
  });
  const response = await nativeFetch("/goform/goform_set_cmd_process", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
    cache: "no-store",
  });
  const result = (await response.json()) as { result?: string };
  if (result.result !== "0" && result.result !== "4")
    throw new Error("Router login was rejected");
  credentials = { username: user, password };
}

async function ensureAuth() {
  if (value((await get("loginfo")).loginfo) === "ok") return;
  if (!credentials) throw new Error("Router login required");
  await login(credentials.username, credentials.password);
  if (value((await get("loginfo")).loginfo) !== "ok")
    throw new Error("Router login was rejected");
}

async function accessId() {
  const versions = await get("wa_inner_version,cr_version");
  const random = await get("RD");
  return md5(
    `${md5(`${value(versions.wa_inner_version)}${value(versions.cr_version)}`)}${value(random.RD)}`,
  );
}

async function post(values: Record<string, string>) {
  const body = new URLSearchParams({
    isTest: "false",
    ...values,
    AD: await accessId(),
  });
  const response = await nativeFetch("/goform/goform_set_cmd_process", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Router returned ${response.status}`);
  const result = (await response.json()) as { result?: string };
  if (
    result.result !== "success" &&
    result.result !== "0" &&
    result.result !== "4"
  ) {
    throw new Error(
      `Router rejected the change (${result.result || "unknown"})`,
    );
  }
  return result;
}

async function status() {
  await ensureAuth();
  const [state, wifiResponse, lanResponse, namesResponse, radio] =
    await Promise.all([
      get(statusCommands),
      getParams({ cmd: "station_list" }),
      getParams({ cmd: "lan_station_list" }),
      getParams({ cmd: "hostNameList" }),
      get("lte_band_lock,wcdma_band_lock,net_select"),
    ]);
  Object.assign(state, radio);
  const customNames = new Map<string, string>();
  const named = Array.isArray(namesResponse.devices)
    ? (namesResponse.devices as Json[])
    : [];
  for (const device of named) {
    const mac = value(device.mac || device.mac_addr).toUpperCase();
    const name = value(device.hostname || device.name);
    if (mac && name) customNames.set(mac, name);
  }
  const wifi = Array.isArray(wifiResponse.station_list)
    ? (wifiResponse.station_list as Json[])
    : [];
  const lanCandidate = lanResponse.lan_station_list ?? lanResponse.station_list;
  const lan = Array.isArray(lanCandidate) ? (lanCandidate as Json[]) : [];
  const unique = new Map<string, { station: Json; connection: string }>();
  for (const station of wifi) {
    const mac = value(station.mac_addr || station.mac).toUpperCase();
    if (mac) unique.set(mac, { station, connection: "Wi-Fi" });
  }
  for (const station of lan) {
    const mac = value(station.mac_addr || station.mac).toUpperCase();
    if (mac && !unique.has(mac))
      unique.set(mac, { station, connection: "Ethernet" });
  }
  if (!unique.size)
    for (const mac of value(state.station_mac).split(";").filter(Boolean))
      unique.set(mac.toUpperCase(), {
        station: {
          mac_addr: mac,
          hostname: `Device ${mac.slice(-5)}`,
          ip_addr: "",
        },
        connection: "Wi-Fi",
      });
  const devices = Array.from(unique.entries()).map(
    ([mac, { station, connection }]) => {
      const name =
        customNames.get(mac) ||
        value(station.hostname || station.host_name || station.name) ||
        "Unknown device";
      const ip = value(station.ip_addr || station.ip);
      return {
        name,
        detail: `${connection} / ${ip}`,
        activity: "Connected",
        mark: initials(name),
        macAddress: mac,
        ipAddress: ip,
      };
    },
  );
  const blockedMacs = value(state.wifi_mac_black_list)
      .split(";")
      .filter(Boolean),
    blockedNames = value(state.wifi_hostname_black_list).split(";");
  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    connected: value(state.ppp_status) === "ppp_connected",
    networkType: value(state.network_type),
    provider: value(state.network_provider),
    signalBars: numeric(state.signalbar),
    signalDbm: numeric(state.lte_rsrp),
    sinr: numeric(state.lte_snr),
    rsrq: numeric(state.lte_rsrq),
    rssi: numeric(state.lte_rssi),
    physicalCell: value(state.lte_pci),
    cellId: value(state.cell_id),
    band: value(state.wan_active_band),
    channel: value(state.wan_active_channel),
    antennaChains: [1, 2, 3, 4].map((id) => ({
      id,
      rsrp: numeric(state[`lte_rsrp_${id}`]),
      sinr: numeric(state[`lte_snr_${id}`]),
    })),
    power: {
      source:
        value(state.mode_main_state) === "mode_power_on_charger"
          ? "12V DC adapter"
          : "External DC",
      batteryPresent: value(state.battery_exist) === "1",
      batteryPercent: numeric(state.battery_value),
      temperatureC: numeric(state.battery_temp),
      txPower: value(state.tx_power),
      wattsAvailable: false,
    },
    downloadMbps: (numeric(state.realtime_rx_thrpt) * 8) / 1_000_000,
    uploadMbps: (numeric(state.realtime_tx_thrpt) * 8) / 1_000_000,
    receivedBytes: numeric(state.realtime_rx_bytes),
    sentBytes: numeric(state.realtime_tx_bytes),
    uptimeSeconds: numeric(state.realtime_time),
    monthlyReceivedBytes: numeric(state.monthly_rx_bytes),
    monthlySentBytes: numeric(state.monthly_tx_bytes),
    ssid: value(state.SSID1),
    coverage: value(state.wifi_coverage).replace("_mode", ""),
    maxDevices: numeric(state.MAX_Access_num) || 32,
    authMode: value(state.AuthMode),
    lanIp: value(state.lan_ipaddr),
    wanIp: value(state.wan_ipaddr),
    softwareVersion: value(state.wa_inner_version),
    hardwareVersion: value(state.hardware_version),
    webVersion: value(state.web_version),
    imei: value(state.imei),
    unreadMessages: numeric(state.sms_unread_num),
    userIpAddress: value(state.user_ip_addr),
    blockedDevices: blockedMacs.map((macAddress, index) => ({
      name: blockedNames[index] || "Blocked device",
      macAddress,
    })),
    apn: {
      profileName:
        value(state.profile_name_ui) ||
        value(state.m_profile_name) ||
        value(state.profile_name),
      accessPoint: value(state.wan_apn_ui) || value(state.wan_apn),
      authMode: (
        value(state.ppp_auth_mode_ui) ||
        value(state.ppp_auth_mode) ||
        "none"
      ).toLowerCase(),
      username: value(state.ppp_username_ui) || value(state.ppp_username),
      index: value(state.Current_index) || "0",
      mode: value(state.apn_mode),
      interfaceVersion: numeric(state.apn_interface_version),
    },
    wifiAdvanced: {
      mode: value(state.WirelessMode) || "4",
      countryCode: value(state.CountryCode) || "US",
      channel: value(state.Channel) || "0",
      rate: value(state.HT_MCS) || "0",
      bandwidth: value(state.wifi_11n_cap) || "1",
      band: value(state.wifi_band) || "b",
    },
    devices,
  };
}

function decodeModemText(input: unknown) {
  const raw = value(input);
  if (/^(?:[0-9a-fA-F]{4})+$/.test(raw)) {
    let result = "";
    for (let i = 0; i < raw.length; i += 4)
      result += String.fromCharCode(parseInt(raw.slice(i, i + 4), 16));
    return result;
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
function encodeUnicode(input: string) {
  return Array.from(input)
    .map((character) =>
      character.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase(),
    )
    .join("");
}
function smsTime() {
  const d = new Date(),
    two = (n: number) => String(n).padStart(2, "0"),
    offset = -d.getTimezoneOffset() / 60;
  return `${String(d.getFullYear()).slice(-2)};${two(d.getMonth() + 1)};${two(d.getDate())};${two(d.getHours())};${two(d.getMinutes())};${two(d.getSeconds())};${offset >= 0 ? "+" : ""}${offset}`;
}
function smsDate(input: unknown) {
  const parts = value(input).split(",");
  return parts.length < 6
    ? value(input)
    : `20${parts[0]}-${parts[1]}-${parts[2]} ${parts[3]}:${parts[4]}:${parts[5]}`;
}

async function communicationsGet() {
  await ensureAuth();
  const [sms, capacity] = await Promise.all([
    getParams({
      cmd: "sms_data_total",
      page: "0",
      data_per_page: "500",
      mem_store: "1",
      tags: "10",
      order_by: "order by id desc",
    }),
    get("sms_capacity_info"),
  ]);
  const raw = Array.isArray(sms.messages) ? (sms.messages as Json[]) : [];
  return {
    ok: true,
    messages: raw.map((item) => ({
      id: text(item.id, 32),
      number: text(item.number, 64),
      content: decodeModemText(item.content),
      time: smsDate(item.date),
      unread: value(item.tag) === "1",
      tag: text(item.tag, 8),
    })),
    capacity: {
      total: numeric(capacity.sms_nv_total),
      received: numeric(capacity.sms_nv_rev_total),
      sent: numeric(capacity.sms_nv_send_total),
      drafts: numeric(capacity.sms_nv_draftbox_total),
    },
  };
}

async function communicationsPost(action: string, payload: Json) {
  await ensureAuth();
  if (action === "sms_send")
    await post({
      goformId: "SEND_SMS",
      Number: text(payload.number, 32),
      sms_time: smsTime(),
      MessageBody: encodeUnicode(text(payload.message, 765)),
      ID: "-1",
      encode_type: "UNICODE",
    });
  else if (action === "sms_read")
    await post({
      goformId: "SET_MSG_READ",
      msg_id: `${text(payload.id, 32)};`,
      tag: "0",
    });
  else if (action === "sms_delete")
    await post({ goformId: "DELETE_SMS", msg_id: `${text(payload.id, 32)};` });
  else if (action === "ussd_cancel")
    await post({ goformId: "USSD_PROCESS", USSD_operator: "ussd_cancel" });
  else if (action === "ussd_send" || action === "ussd_reply") {
    const command = text(payload.command, 182),
      reply = action === "ussd_reply";
    await post({
      goformId: "USSD_PROCESS",
      USSD_operator: reply ? "ussd_reply" : "ussd_send",
      [reply ? "USSD_reply_number" : "USSD_send_number"]: command,
    });
    for (let attempt = 0; attempt < 45; attempt++) {
      await delay(1000);
      const flag = value(
        (await getParams({ cmd: "ussd_write_flag" })).ussd_write_flag,
      );
      if (flag === "15") continue;
      if (flag === "16") {
        const result = await getParams({ cmd: "ussd_data_info" });
        return {
          ok: true,
          action,
          response: {
            content: decodeModemText(result.ussd_data),
            action: value(result.ussd_action),
            dcs: value(result.ussd_dcs),
          },
        };
      }
      throw new Error(
        (
          {
            "1": "No mobile service",
            "2": "Network ended the session",
            "3": "USSD request timed out",
            "4": "USSD request timed out",
            "10": "Please retry the USSD request",
            "41": "Operation not supported",
            "99": "USSD is unsupported",
          } as Record<string, string>
        )[flag] || "USSD request failed",
      );
    }
    throw new Error("USSD request timed out");
  } else throw new Error("Unsupported communication action");
  return { ok: true, action };
}

async function radioGet() {
  await ensureAuth();
  const data = await get(
    "lte_band_lock,wcdma_band_lock,net_select,lte_pci,cell_id,wan_active_band,wan_active_channel,lte_rsrp,lte_rsrq,lte_snr",
  );
  const locked = value(data.lte_band_lock);
  return {
    ok: true,
    networkSelection: value(data.net_select),
    lteBandLock: locked,
    wcdmaBandLock: value(data.wcdma_band_lock),
    selectedBands: selectedBands(locked),
    availableBands: Object.keys(masks),
    current: {
      band: value(data.wan_active_band),
      channel: value(data.wan_active_channel),
      pci: value(data.lte_pci),
      cellId: value(data.cell_id),
      rsrp: numeric(data.lte_rsrp),
      rsrq: numeric(data.lte_rsrq),
      sinr: numeric(data.lte_snr),
    },
    cellLockSupported: false,
    neighborScanSupported: false,
    cellLockReason:
      "The modem adapter contains neighbor-cell telemetry internally, but this MF293N firmware exposes no authenticated neighbor scan or cell-lock command. Beacon will not guess a write command.",
  };
}

async function radioPost(action: string, payload: Json) {
  if (action !== "band_update") throw new Error("Unsupported radio action");
  await ensureAuth();
  const selected = Array.isArray(payload.bands)
    ? payload.bands.map(String).filter((band) => masks[band])
    : [];
  if (!selected.length) throw new Error("Select at least one LTE band");
  const connected =
    value((await get("ppp_status")).ppp_status) === "ppp_connected";
  if (connected) {
    await post({ goformId: "DISCONNECT_NETWORK" });
    await delay(2500);
  }
  let applied: string[] = [];
  try {
    await post({
      goformId: "SET_NETWORK_BAND_LOCK",
      lte_band_lock: selected.map((band) => masks[band]).join(";") + ";",
      wcdma_band_lock: "0x000000000",
      is_gw_band: "1",
      is_lte_band: "0",
    });
    for (let attempt = 0; attempt < 8; attempt++) {
      await delay(500);
      applied = selectedBands((await get("lte_band_lock")).lte_band_lock);
      if (
        selected.every((band) => applied.includes(band)) &&
        applied.length === selected.length
      )
        break;
    }
    if (
      !selected.every((band) => applied.includes(band)) ||
      applied.length !== selected.length
    )
      throw new Error(
        `Band lock verification failed; router reports ${applied.join(", ") || "none"}`,
      );
  } finally {
    if (connected) {
      await post({ goformId: "CONNECT_NETWORK" });
    }
  }
  return { ok: true, action, appliedBands: applied };
}

function parseTraffic(data: Json) {
  const rules = [] as Json[];
  for (let index = 0; index < 10; index++) {
    const raw = value(data[`userspeedlimit_${index}`]);
    if (!raw) continue;
    const fields = raw.split(",");
    rules.push({
      index,
      ipStart: fields[0] || "",
      ipEnd: fields[1] || "",
      portStart: fields[2] || "1",
      portEnd: fields[3] || "65535",
      protocol: fields[4] === "0" ? "ALL" : fields[4] === "1" ? "TCP" : "UDP",
      priority: fields[5] || "1",
      uploadMin: numeric(fields[6]),
      uploadMax: numeric(fields[7]),
      downloadMin: numeric(fields[8]),
      downloadMax: numeric(fields[9]),
      enabled: fields[10] !== "0",
    });
  }
  return {
    ok: true,
    enabled: value(data.tc_traffic_enable) === "1",
    uploadTotal: numeric(data.upload_width_manual),
    downloadTotal: numeric(data.download_width_manual),
    rules,
  };
}
async function trafficGet() {
  await ensureAuth();
  return parseTraffic(await get(trafficCommands));
}
async function trafficPost(action: string, payload: Json) {
  await ensureAuth();
  if (action === "traffic_delete") {
    const index = Math.trunc(numeric(payload.index));
    if (index < 0 || index > 9) throw new Error("Invalid speed-limit rule");
    await post({ goformId: "TRAFFIC_CONTROL_DEL", delete_id: `${index};` });
    return { ok: true, action };
  }
  if (action === "traffic_toggle") {
    const enabled = payload.enabled === true;
    await post({
      goformId: "TRAFFIC_CONTROL_SWITCH_SET",
      tc_traffic_enable: enabled ? "1" : "0",
      upload_width_manual: String(
        Math.max(100, numeric(payload.uploadTotal) || 1_000_000),
      ),
      download_width_manual: String(
        Math.max(100, numeric(payload.downloadTotal) || 1_000_000),
      ),
    });
    return { ok: true, action };
  }
  if (action !== "traffic_upsert")
    throw new Error("Unsupported traffic-control action");
  const ip = text(payload.ip, 48),
    upload = Math.trunc(numeric(payload.uploadKbps)),
    download = Math.trunc(numeric(payload.downloadKbps));
  if (!validIpv4(ip)) throw new Error("Enter a valid device IPv4 address");
  if (
    upload < 10 ||
    download < 10 ||
    upload > 1_000_000 ||
    download > 1_000_000
  )
    throw new Error("Speed limits must be between 10 and 1,000,000 Kbps");
  const current = await get(trafficCommands),
    parsed = parseTraffic(current) as {
      uploadTotal: number;
      downloadTotal: number;
    };
  const uploadTotal = Math.max(100, parsed.uploadTotal, upload),
    downloadTotal = Math.max(100, parsed.downloadTotal, download);
  await post({
    goformId: "TRAFFIC_CONTROL_SWITCH_SET",
    tc_traffic_enable: "1",
    upload_width_manual: String(uploadTotal),
    download_width_manual: String(downloadTotal),
  });
  const maybeIndex = value(payload.index),
    values = {
      enable: "1",
      ip_start: ip,
      ip_end: ip,
      portStart: "1",
      portEnd: "65535",
      protocol: "ALL",
      priority: "1",
      upload_min: String(Math.min(10, upload)),
      upload_max: String(upload),
      download_min: String(Math.min(10, download)),
      download_max: String(download),
    };
  if (maybeIndex !== "")
    await post({
      goformId: "TRAFFIC_CONTROL_EDIT",
      index: maybeIndex,
      ...values,
    });
  else await post({ goformId: "TRAFFIC_CONTROL_ADD", ...values });
  return { ok: true, action };
}

async function tunnelsGet() {
  await ensureAuth();
  const data = await get(
    "vpn_passthr_Enabled,dns_mode_ui,dns_mode,prefer_dns_manual_ui,prefer_dns_manual,standby_dns_manual_ui,standby_dns_manual",
  );
  return {
    ok: true,
    dnsMode: value(data.dns_mode_ui) || value(data.dns_mode) || "auto",
    primaryDns:
      value(data.prefer_dns_manual_ui) || value(data.prefer_dns_manual),
    secondaryDns:
      value(data.standby_dns_manual_ui) || value(data.standby_dns_manual),
    vpnPassthrough: value(data.vpn_passthr_Enabled) !== "0",
    runtimes: {
      v2ray: false,
      wireguard: false,
      openvpn: false,
      ikev2: false,
      pptp: false,
      l2tp: false,
    },
    platform: {
      architecture: "ARMv7",
      kernel: "Linux 3.4.110",
      freeFlashMb: 14.4,
      ramMb: 54,
      tunDevice: false,
      externalStorage: false,
    },
    reason:
      "Tunnel runtime slots are ready, but this MF293N has no TUN device or WireGuard module and does not have enough flash or RAM for current V2Ray/Xray packages. DNS and client VPN passthrough work now; router-hosted runtimes require compatible external storage and a tested ARMv7 binary.",
  };
}
async function tunnelsPost(action: string, payload: Json) {
  if (action !== "dns_update") throw new Error("Unsupported tunnel action");
  await ensureAuth();
  const primary = text(payload.primaryDns, 48),
    secondary = text(payload.secondaryDns, 48),
    manual = payload.manual === true;
  if (manual && (!validIpv4(primary) || (secondary && !validIpv4(secondary))))
    throw new Error("Enter valid IPv4 DNS server addresses");
  const current = await get(
    "Current_index,m_profile_name,profile_name,wan_apn_ui,wan_apn,ppp_auth_mode_ui,ppp_auth_mode,ppp_username_ui,ppp_username,ppp_passwd_ui,ppp_passwd",
  );
  await post({
    goformId: "APN_PROC_EX",
    apn_action: "save",
    apn_mode: "manual",
    profile_name:
      value(current.m_profile_name) || value(current.profile_name) || "Mobile",
    wan_dial: "*99#",
    apn_select: "manual",
    pdp_type: "IP",
    pdp_select: "auto",
    pdp_addr: "",
    index: value(current.Current_index) || "0",
    wan_apn: value(current.wan_apn_ui) || value(current.wan_apn),
    ppp_auth_mode: (
      value(current.ppp_auth_mode_ui) ||
      value(current.ppp_auth_mode) ||
      "none"
    ).toLowerCase(),
    ppp_username: value(current.ppp_username_ui) || value(current.ppp_username),
    ppp_passwd: value(current.ppp_passwd_ui) || value(current.ppp_passwd),
    dns_mode: manual ? "manual" : "auto",
    prefer_dns_manual: manual ? primary : "",
    standby_dns_manual: manual ? secondary : "",
  });
  return { ok: true, action };
}

async function control(action: string, payload: Json) {
  await ensureAuth();
  if (action === "wifi_update") {
    const ssid = text(payload.ssid, 32),
      current = await get(
        "AuthMode,WPAPSK1_encode,HideSSID,NoForwarding,MAX_Access_num,wifi_coverage",
      ),
      supplied = text(payload.passphrase, 63);
    const passphrase =
      supplied ||
      decodeURIComponent(escape(atob(value(current.WPAPSK1_encode))));
    if (!ssid) throw new Error("SSID is required");
    if (passphrase.length < 8 || passphrase.length > 63)
      throw new Error("Wi-Fi password must contain 8 to 63 characters");
    await post({
      goformId: "SET_WIFI_SSID1_SETTINGS",
      ssid,
      broadcastSsidEnabled: value(current.HideSSID) || "0",
      MAX_Access_num: String(
        Math.max(
          1,
          Math.min(
            32,
            numeric(payload.maxDevices) ||
              numeric(current.MAX_Access_num) ||
              32,
          ),
        ),
      ),
      security_mode: "WPA2PSK",
      cipher: "1",
      NoForwarding: value(current.NoForwarding) || "0",
      qrcode_display_switch: "0",
      security_shared_mode: "1",
      passphrase: base64(passphrase),
    });
    await post({
      goformId: "SET_WIFI_COVERAGE",
      wifi_coverage: ["short_mode", "medium_mode", "long_mode"].includes(
        text(payload.coverage),
      )
        ? text(payload.coverage)
        : value(current.wifi_coverage) || "short_mode",
    });
  } else if (action === "wifi_advanced_update") {
    const mode = ["0", "1", "2", "3", "4"].includes(text(payload.mode))
        ? text(payload.mode)
        : "4",
      channel = Math.trunc(numeric(payload.channel)),
      bandwidth = ["0", "1", "2"].includes(text(payload.bandwidth))
        ? text(payload.bandwidth)
        : "1",
      rate = String(Math.max(0, Math.min(65, numeric(payload.rate)))),
      countryCode = text(payload.countryCode, 4).toUpperCase();
    if (channel < 0 || channel > 13)
      throw new Error(
        "This MF293N supports 2.4 GHz channels 1 to 13, or Auto, subject to country code",
      );
    if (!/^[A-Z]{2}$/.test(countryCode))
      throw new Error("Select a valid two-letter regulatory country code");
    await post({
      goformId: "SET_WIFI_INFO",
      wifiMode: mode,
      countryCode,
      MAX_Access_num: String(
        Math.max(1, Math.min(32, numeric(payload.maxDevices) || 32)),
      ),
      m_MAX_Access_num: "0",
      selectedChannel: String(channel),
      abg_rate: rate,
      wifi_11n_cap: bandwidth,
    });
  } else if (action === "device_block" || action === "device_unblock") {
    const mac = text(payload.macAddress, 32).toUpperCase(),
      name = text(payload.name, 64) || "Device",
      ip = text(payload.ipAddress, 48),
      filter = await get(
        "ACL_mode,wifi_mac_black_list,wifi_hostname_black_list,user_ip_addr",
      );
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac))
      throw new Error("Invalid device address");
    if (action === "device_block" && ip && ip === value(filter.user_ip_addr))
      throw new Error(
        "This device is managing the router and cannot block itself",
      );
    const macs = value(filter.wifi_mac_black_list).split(";").filter(Boolean),
      names = value(filter.wifi_hostname_black_list).split(";");
    const pairs = macs
      .map((item, index) => ({
        mac: item.toUpperCase(),
        name: names[index] || "Device",
      }))
      .filter((item) => item.mac !== mac);
    if (action === "device_block") pairs.push({ mac, name });
    await post({
      goformId: "WIFI_MAC_FILTER",
      ACL_mode: "2",
      macFilteringMode: "2",
      wifi_mac_black_list: pairs.map((item) => item.mac).join(";"),
      wifi_hostname_black_list: pairs.map((item) => item.name).join(";"),
    });
  } else if (action === "device_rename")
    await post({
      goformId: "EDIT_HOSTNAME",
      mac: text(payload.macAddress, 32).toUpperCase(),
      hostname: text(payload.hostname, 32),
    });
  else if (action === "apn_update") {
    const current = await get("Current_index,ppp_passwd_ui,ppp_passwd"),
      index = text(payload.index, 4) || value(current.Current_index) || "0",
      auth = ["none", "pap", "chap"].includes(
        text(payload.authMode).toLowerCase(),
      )
        ? text(payload.authMode).toLowerCase()
        : "none",
      apn = text(payload.accessPoint, 100);
    if (!apn) throw new Error("APN is required");
    await post({
      goformId: "APN_PROC_EX",
      apn_action: "save",
      apn_mode: "manual",
      profile_name: text(payload.profileName, 40) || "Mobile",
      wan_dial: "*99#",
      apn_select: "manual",
      pdp_type: "IP",
      pdp_select: "auto",
      pdp_addr: "",
      index,
      wan_apn: apn,
      ppp_auth_mode: auth,
      ppp_username: text(payload.username, 64),
      ppp_passwd:
        text(payload.apnPassword, 64) ||
        value(current.ppp_passwd_ui || current.ppp_passwd),
      dns_mode: "auto",
      prefer_dns_manual: "",
      standby_dns_manual: "",
    });
    await post({
      goformId: "APN_PROC_EX",
      apn_action: "set_default",
      set_default_flag: "1",
      apn_mode: "manual",
      pdp_type: "IP",
      index,
    });
  } else if (action === "network_reconnect") {
    await post({ goformId: "DISCONNECT_NETWORK" });
    await delay(1200);
    await post({ goformId: "CONNECT_NETWORK" });
  } else if (action === "ota_check")
    await post({
      goformId: "IF_UPGRADE",
      select_op: "check",
      ota_manual_check_roam_state: "1",
    });
  else if (action === "clear_traffic")
    await post({ goformId: "RESET_DATA_COUNTER" });
  else if (action === "restart") await post({ goformId: "REBOOT_DEVICE" });
  else throw new Error("Unsupported router action");
  return { ok: true, action };
}

async function readBody(init?: RequestInit) {
  if (!init?.body) return {} as Json;
  return JSON.parse(String(init.body)) as Json;
}

async function handleApi(path: string, init?: RequestInit) {
  try {
    const method = (init?.method || "GET").toUpperCase();
    if (path === "/api/router/session") {
      if (method === "POST") {
        const body = await readBody(init);
        await login(text(body.username, 64), text(body.password, 128));
        return json({ ok: true });
      }
      if (method === "DELETE") {
        credentials = null;
        return json({ ok: true });
      }
      const authenticated = value((await get("loginfo")).loginfo) === "ok";
      return json({
        authenticated,
        baseUrl: location.origin,
        username: credentials?.username || "admin",
      });
    }
    if (path === "/api/router/status") return json(await status());
    if (path === "/api/router/communications") {
      if (method === "GET") return json(await communicationsGet());
      const body = await readBody(init);
      return json(
        await communicationsPost(
          text(body.action, 40),
          (body.payload || {}) as Json,
        ),
      );
    }
    if (path === "/api/router/radio") {
      if (method === "GET") return json(await radioGet());
      const body = await readBody(init);
      return json(
        await radioPost(text(body.action, 40), (body.payload || {}) as Json),
      );
    }
    if (path === "/api/router/traffic") {
      if (method === "GET") return json(await trafficGet());
      const body = await readBody(init);
      return json(
        await trafficPost(text(body.action, 40), (body.payload || {}) as Json),
      );
    }
    if (path === "/api/router/tunnels") {
      if (method === "GET") return json(await tunnelsGet());
      const body = await readBody(init);
      return json(
        await tunnelsPost(text(body.action, 40), (body.payload || {}) as Json),
      );
    }
    if (path === "/api/router/control") {
      const body = await readBody(init);
      return json(
        await control(text(body.action, 40), (body.payload || {}) as Json),
      );
    }
    return json({ ok: false, error: "Unknown local API route" }, 404);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Router request failed";
    return json(
      { ok: false, error: message },
      message === "Router login required" ? 401 : 400,
    );
  }
}

export function installRouterBridge() {
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(raw, location.href);
    if (
      url.origin === location.origin &&
      url.pathname.startsWith("/api/router/")
    )
      return handleApi(url.pathname, init);
    return nativeFetch(input, init);
  }) as typeof window.fetch;
}

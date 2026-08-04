export const dynamic = "force-dynamic";

import { createRouterClient } from "../router-client";
import { getRouterSession } from "../session-store";

const baseUrl = process.env.ROUTER_BASE_URL || "http://192.168.1.1";
const username = process.env.ROUTER_USERNAME || "";
const password = process.env.ROUTER_PASSWORD || "";
const routerHeaders = { Accept: "application/json, text/javascript, */*; q=0.01", "X-Requested-With": "XMLHttpRequest", Referer: `${baseUrl}/index.html` };

async function routerGet(cmd: string) {
  const query = new URLSearchParams({ isTest: "false", cmd, multi_data: "1", _: Date.now().toString() });
  const response = await fetch(`${baseUrl}/goform/goform_get_cmd_process?${query}`, { headers: routerHeaders, cache: "no-store", signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`Router returned ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.replace(/\r\n/g, "\n")));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function md5(input: string) {
  const bytes = Array.from(new TextEncoder().encode(input));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push(Math.floor(bitLength / 2 ** (8 * i)) & 0xff);
  const shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const constants = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, i) => (bytes[offset+i*4] | bytes[offset+i*4+1]<<8 | bytes[offset+i*4+2]<<16 | bytes[offset+i*4+3]<<24) >>> 0);
    let a=a0,b=b0,c=c0,d=d0;
    for (let i=0;i<64;i++) {
      let f:number,g:number;
      if(i<16){f=(b&c)|(~b&d);g=i;} else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;} else if(i<48){f=b^c^d;g=(3*i+5)%16;} else {f=c^(b|~d);g=(7*i)%16;}
      const sum=(a+f+constants[i]+words[g])>>>0;
      a=d;d=c;c=b;b=(b+((sum<<shifts[i])|(sum>>>(32-shifts[i]))))>>>0;
    }
    a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0;
  }
  return [a0,b0,c0,d0].map((word)=>[0,8,16,24].map((shift)=>((word>>>shift)&255).toString(16).padStart(2,"0")).join("")).join("");
}

async function login() {
  if (!username || !password) throw new Error("Router credentials are not configured");
  const salt = String((await routerGet("LD")).LD || "");
  const encoded = await sha256(`${await sha256(password)}${salt}`);
  const body = new URLSearchParams({ isTest: "false", goformId: "LOGIN_MULTI_USER", password: encoded, user: username });
  const response = await fetch(`${baseUrl}/goform/goform_set_cmd_process`, { method: "POST", headers: { ...routerHeaders, Origin: baseUrl, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body, cache: "no-store", signal: AbortSignal.timeout(6000) });
  const result = await response.json() as { result?: string };
  if (result.result !== "0" && result.result !== "4") throw new Error("Router login was rejected");
}

async function ensureAuth() {
  if ((await routerGet("loginfo")).loginfo !== "ok") await login();
}

async function accessId() {
  const language = await routerGet("wa_inner_version,cr_version");
  const random = await routerGet("RD");
  return md5(`${md5(`${String(language.wa_inner_version || "")}${String(language.cr_version || "")}`)}${String(random.RD || "")}`);
}

async function routerPost(values: Record<string, string>) {
  const body = new URLSearchParams({ isTest: "false", ...values, AD: await accessId() });
  const response = await fetch(`${baseUrl}/goform/goform_set_cmd_process`, { method: "POST", headers: { ...routerHeaders, Origin: baseUrl, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Router returned ${response.status}`);
  const result = await response.json() as { result?: string };
  if (result.result !== "success" && result.result !== "0" && result.result !== "4") throw new Error(`Router rejected the change (${result.result || "unknown"})`);
  return result;
}

function text(value: unknown, max = 128) { return String(value ?? "").trim().slice(0, max); }
function requireConfirmed(value: unknown) { if (value !== true) throw new Error("Confirmation is required"); }
function base64(value: string) { return btoa(unescape(encodeURIComponent(value))); }

export async function POST(request: Request) {
  try {
    const session = getRouterSession(request);
    if (!session) return Response.json({ ok: false, error: "Router login required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const client = createRouterClient(session);
    const routerGet = client.get;
    const routerPost = client.post;
    const input = await request.json() as { action?: string; payload?: Record<string, unknown>; confirmed?: boolean };
    const action = text(input.action, 40);
    const payload = input.payload || {};
    requireConfirmed(input.confirmed);
    await client.ensureAuth();

    if (action === "validate_access") {
      await client.accessId();
      return Response.json({ ok: true, action }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "wifi_update") {
      const ssid = text(payload.ssid, 32);
      if (!ssid) throw new Error("SSID is required");
      const current = await routerGet("AuthMode,WPAPSK1_encode,HideSSID,NoForwarding,MAX_Access_num,wifi_coverage");
      const suppliedPassword = text(payload.passphrase, 63);
      const passphrase = suppliedPassword || decodeURIComponent(escape(atob(String(current.WPAPSK1_encode || ""))));
      if (passphrase.length < 8 || passphrase.length > 63) throw new Error("Wi-Fi password must contain 8 to 63 characters");
      const maxDevices = Math.max(1, Math.min(32, Number(payload.maxDevices) || Number(current.MAX_Access_num) || 32));
      await routerPost({ goformId: "SET_WIFI_SSID1_SETTINGS", ssid, broadcastSsidEnabled: String(current.HideSSID || "0"), MAX_Access_num: String(maxDevices), security_mode: "WPA2PSK", cipher: "1", NoForwarding: String(current.NoForwarding || "0"), qrcode_display_switch: "0", security_shared_mode: "1", passphrase: base64(passphrase) });
      const coverage = ["short_mode","medium_mode","long_mode"].includes(text(payload.coverage)) ? text(payload.coverage) : String(current.wifi_coverage || "short_mode");
      await routerPost({ goformId: "SET_WIFI_COVERAGE", wifi_coverage: coverage });
    } else if (action === "device_block" || action === "device_unblock") {
      const mac = text(payload.macAddress, 32).toUpperCase();
      const name = text(payload.name, 64) || "Device";
      const ipAddress = text(payload.ipAddress, 48);
      if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) throw new Error("Invalid device address");
      const filter = await routerGet("ACL_mode,wifi_mac_black_list,wifi_hostname_black_list,user_ip_addr");
      if (action === "device_block" && ipAddress && ipAddress === String(filter.user_ip_addr || "")) throw new Error("This device is managing the router and cannot block itself");
      const macs = String(filter.wifi_mac_black_list || "").split(";").filter(Boolean);
      const names = String(filter.wifi_hostname_black_list || "").split(";");
      const pairs = macs.map((item,index)=>({ mac:item.toUpperCase(), name:names[index] || "Device" })).filter((item)=>item.mac!==mac);
      if (action === "device_block") pairs.push({ mac, name });
      if (pairs.length > 32) throw new Error("The router blacklist is full");
      await routerPost({ goformId: "WIFI_MAC_FILTER", ACL_mode: "2", macFilteringMode: "2", wifi_mac_black_list: pairs.map((item)=>item.mac).join(";"), wifi_hostname_black_list: pairs.map((item)=>item.name).join(";") });
    } else if (action === "device_rename") {
      const mac = text(payload.macAddress, 32).toUpperCase();
      const hostname = text(payload.hostname, 32);
      if (!hostname) throw new Error("Device name is required");
      await routerPost({ goformId: "EDIT_HOSTNAME", mac, hostname });
    } else if (action === "apn_update") {
      const current = await routerGet("Current_index,ppp_passwd_ui,ppp_passwd,pdp_type_ui,pdp_type");
      const accessPoint = text(payload.accessPoint, 100);
      if (!accessPoint) throw new Error("APN is required");
      const index = text(payload.index, 4) || String(current.Current_index || "0");
      const authMode = ["none","pap","chap"].includes(text(payload.authMode).toLowerCase()) ? text(payload.authMode).toLowerCase() : "none";
      await routerPost({ goformId: "APN_PROC_EX", apn_action: "save", apn_mode: "manual", profile_name: text(payload.profileName, 40) || "Mobile", wan_dial: "*99#", apn_select: "manual", pdp_type: "IP", pdp_select: "auto", pdp_addr: "", index, wan_apn: accessPoint, ppp_auth_mode: authMode, ppp_username: text(payload.username, 64), ppp_passwd: text(payload.apnPassword, 64) || String(current.ppp_passwd_ui || current.ppp_passwd || ""), dns_mode: "auto", prefer_dns_manual: "", standby_dns_manual: "" });
      await routerPost({ goformId: "APN_PROC_EX", apn_action: "set_default", set_default_flag: "1", apn_mode: "manual", pdp_type: "IP", index });
    } else if (action === "network_reconnect") {
      await routerPost({ goformId: "DISCONNECT_NETWORK" });
      await new Promise((resolve)=>setTimeout(resolve, 1200));
      await routerPost({ goformId: "CONNECT_NETWORK" });
    } else if (action === "ota_check") {
      await routerPost({ goformId: "IF_UPGRADE", select_op: "check", ota_manual_check_roam_state: "1" });
    } else if (action === "clear_traffic") {
      await routerPost({ goformId: "RESET_DATA_COUNTER" });
    } else if (action === "restart") {
      await routerPost({ goformId: "REBOOT_DEVICE" });
    } else {
      throw new Error("Unsupported router action");
    }

    return Response.json({ ok: true, action }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Router action failed";
    return Response.json({ ok: false, error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

import type { RouterCredentials } from "./session-store";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.replace(/\r\n/g, "\n")));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function md5(input: string) {
  const bytes = Array.from(new TextEncoder().encode(input));
  const bitLength = bytes.length * 8;
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push(Math.floor(bitLength / 2 ** (8 * i)) & 0xff);
  const shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const constants = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
  for (let offset=0;offset<bytes.length;offset+=64) {
    const words=Array.from({length:16},(_,i)=>(bytes[offset+i*4]|bytes[offset+i*4+1]<<8|bytes[offset+i*4+2]<<16|bytes[offset+i*4+3]<<24)>>>0);
    let a=a0,b=b0,c=c0,d=d0;
    for(let i=0;i<64;i++){let f:number,g:number;if(i<16){f=(b&c)|(~b&d);g=i;}else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;}else if(i<48){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=(7*i)%16;}const sum=(a+f+constants[i]+words[g])>>>0;a=d;d=c;c=b;b=(b+((sum<<shifts[i])|(sum>>>(32-shifts[i]))))>>>0;}
    a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0;
  }
  return [a0,b0,c0,d0].map((word)=>[0,8,16,24].map((shift)=>((word>>>shift)&255).toString(16).padStart(2,"0")).join("")).join("");
}

export function createRouterClient(credentials: RouterCredentials) {
  const baseUrl = credentials.baseUrl.replace(/\/$/, "");
  const headers = { Accept: "application/json, text/javascript, */*; q=0.01", "X-Requested-With": "XMLHttpRequest", Referer: `${baseUrl}/index.html` };
  async function get(cmd: string) {
    return getParams({ cmd, multi_data: "1" });
  }
  async function getParams(values: Record<string, string>) {
    const query = new URLSearchParams({ isTest: "false", ...values, _: Date.now().toString() });
    const response = await fetch(`${baseUrl}/goform/goform_get_cmd_process?${query}`, { headers, cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`Router returned ${response.status}`);
    return response.json() as Promise<Record<string, unknown>>;
  }
  async function login() {
    const salt = String((await get("LD")).LD || "");
    const encoded = await sha256(`${await sha256(credentials.password)}${salt}`);
    const body = new URLSearchParams({ isTest: "false", goformId: "LOGIN_MULTI_USER", password: encoded, user: credentials.username });
    const response = await fetch(`${baseUrl}/goform/goform_set_cmd_process`, { method: "POST", headers: { ...headers, Origin: baseUrl, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body, cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`Router login returned ${response.status}`);
    const result = await response.json() as { result?: string };
    if (result.result !== "0" && result.result !== "4") throw new Error("Router login was rejected");
  }
  async function ensureAuth() {
    if ((await get("loginfo")).loginfo !== "ok") await login();
    if ((await get("loginfo")).loginfo !== "ok") throw new Error("Router login was rejected");
  }
  async function accessId() {
    const versions = await get("wa_inner_version,cr_version");
    const random = await get("RD");
    return md5(`${md5(`${String(versions.wa_inner_version || "")}${String(versions.cr_version || "")}`)}${String(random.RD || "")}`);
  }
  async function post(values: Record<string, string>) {
    const body = new URLSearchParams({ isTest: "false", ...values, AD: await accessId() });
    const response = await fetch(`${baseUrl}/goform/goform_set_cmd_process`, { method: "POST", headers: { ...headers, Origin: baseUrl, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Router returned ${response.status}`);
    const result = await response.json() as { result?: string };
    if (result.result !== "success" && result.result !== "0" && result.result !== "4") throw new Error(`Router rejected the change (${result.result || "unknown"})`);
    return result;
  }
  return { get, getParams, ensureAuth, accessId, post };
}

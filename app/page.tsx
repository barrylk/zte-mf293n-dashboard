"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Device = { name: string; detail: string; activity: string; mark: string; macAddress: string; ipAddress: string };
type PendingAction = { action: string; title: string; description: string; payload?: Record<string, unknown>; danger?: boolean; endpoint?: "control" | "communications" | "radio"; onSuccess?: (result: Record<string, unknown>) => void };
type SmsMessage = { id: string; number: string; content: string; time: string; unread: boolean; tag: string };
type RouterData = {
  connected: boolean; networkType: string; provider: string; signalBars: number; signalDbm: number;
  sinr: number; rsrq: number; rssi: number; physicalCell: string; cellId: string; band: string;
  channel: string; downloadMbps: number; uploadMbps: number; receivedBytes: number; sentBytes: number;
  uptimeSeconds: number; monthlyReceivedBytes: number; monthlySentBytes: number; ssid: string;
  coverage: string; maxDevices: number; authMode: string; lanIp: string; wanIp: string;
  softwareVersion: string; hardwareVersion: string; webVersion: string; imei: string;
  unreadMessages: number; devices: Device[]; updatedAt: string; userIpAddress: string;
  blockedDevices: Array<{ name: string; macAddress: string }>;
  apn: { profileName: string; accessPoint: string; authMode: string; username: string; index: string; mode: string; interfaceVersion: number };
};

const emptyData: RouterData = {
  connected: false, networkType: "--", provider: "--", signalBars: 0, signalDbm: 0,
  sinr: 0, rsrq: 0, rssi: 0, physicalCell: "--", cellId: "--", band: "--", channel: "--",
  downloadMbps: 0, uploadMbps: 0, receivedBytes: 0, sentBytes: 0, uptimeSeconds: 0,
  monthlyReceivedBytes: 0, monthlySentBytes: 0, ssid: "--", coverage: "--", maxDevices: 0,
  authMode: "--", lanIp: "--", wanIp: "--", softwareVersion: "--", hardwareVersion: "--",
  webVersion: "--", imei: "--", unreadMessages: 0, devices: [], updatedAt: "",
  userIpAddress: "", blockedDevices: [], apn: { profileName: "", accessPoint: "", authMode: "none", username: "", index: "0", mode: "", interfaceVersion: 0 },
};

const nav = ["Overview", "Network", "Wi-Fi", "Devices", "Messages", "System"];
const sectionCopy: Record<string, { eyebrow: string; title: string; note: string }> = {
  Overview: { eyebrow: "Home network", title: "Router overview", note: "Live status from your ZTE MF293N." },
  Network: { eyebrow: "Cellular connection", title: "Network", note: "Live radio quality, carrier details and internet path." },
  "Wi-Fi": { eyebrow: "Wireless network", title: "Wi-Fi", note: "Current SSID, coverage and client capacity." },
  Devices: { eyebrow: "Connected clients", title: "Devices", note: "Devices currently reported by the router." },
  Messages: { eyebrow: "Router inbox", title: "Messages", note: "Live unread count from the device." },
  System: { eyebrow: "Router information", title: "System", note: "Firmware, hardware and device identity." },
};

export default function Home() {
  const [auth, setAuth] = useState<"checking" | "loggedOut" | "loggedIn">("checking");
  const [routerAddress, setRouterAddress] = useState("http://192.168.1.1");
  const [routerUsername, setRouterUsername] = useState("admin");
  const [routerPassword, setRouterPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [active, setActive] = useState("Overview");
  const [data, setData] = useState<RouterData>(emptyData);
  const [history, setHistory] = useState<number[]>([]);
  const [hidden, setHidden] = useState(true);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [acting, setActing] = useState(false);

  const visibleDevices = useMemo(() => data.devices.filter((device) => device.name.toLowerCase().includes(query.toLowerCase())), [data.devices, query]);
  const copy = sectionCopy[active];

  async function loadStatus(manual = false) {
    try {
      const response = await fetch("/api/router/status", { cache: "no-store" });
      const result = await response.json();
      if (response.status === 401) { setAuth("loggedOut"); setData(emptyData); return; }
      if (!response.ok || !result.ok) throw new Error(result.error || "Router did not respond");
      setData(result as RouterData);
      setHistory((current) => [...current, Number(result.downloadMbps) || 0].slice(-24));
      setError("");
      if (manual) notify("Live router status refreshed");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reach router");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/router/session", { cache: "no-store" }).then((response)=>response.json()).then((result)=>{
      if(result.authenticated){setRouterAddress(result.baseUrl);setRouterUsername(result.username);setAuth("loggedIn");}
      else setAuth("loggedOut");
    }).catch(()=>setAuth("loggedOut"));
  }, []);

  useEffect(() => {
    if(auth!=="loggedIn") return;
    setLoading(true); loadStatus();
    const timer = window.setInterval(() => loadStatus(), 5000);
    return () => window.clearInterval(timer);
  }, [auth]);

  async function login(event: FormEvent) {
    event.preventDefault(); setLoggingIn(true); setLoginError("");
    try {
      const response=await fetch("/api/router/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({baseUrl:routerAddress,username:routerUsername,password:routerPassword})});
      const result=await response.json(); if(!response.ok||!result.ok)throw new Error(result.error||"Login failed");
      setRouterPassword(""); setAuth("loggedIn");
    } catch(caught){setLoginError(caught instanceof Error?caught.message:"Unable to log in");}
    finally{setLoggingIn(false);}
  }

  async function logout() {
    await fetch("/api/router/session",{method:"DELETE"}); setData(emptyData); setHistory([]); setAuth("loggedOut");
  }

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function choose(item: string) {
    setActive(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function applyAction() {
    if (!pending) return;
    setActing(true);
    try {
      const response = await fetch(`/api/router/${pending.endpoint || "control"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: pending.action, payload: pending.payload || {}, confirmed: true }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Router rejected the change");
      notify(`${pending.title} completed`);
      pending.onSuccess?.(result as Record<string, unknown>);
      setPending(null);
      window.setTimeout(() => loadStatus(), pending.action === "restart" ? 12000 : 1200);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Router action failed");
    } finally {
      setActing(false);
    }
  }

  if(auth!=="loggedIn") return <LoginScreen checking={auth==="checking"} address={routerAddress} setAddress={setRouterAddress} username={routerUsername} setUsername={setRouterUsername} password={routerPassword} setPassword={setRouterPassword} error={loginError} loading={loggingIn} submit={login} />;

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <button className="brand" onClick={() => choose("Overview")} aria-label="Beacon dashboard home"><span className="brand-mark"><i /><i /><i /></span><span>beacon</span></button>
        <nav className="nav-list">{nav.map((item, index) => <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => choose(item)} aria-current={active === item ? "page" : undefined}><span className="nav-index">0{index + 1}</span>{item}{item === "Messages" && data.unreadMessages > 0 && <span className="nav-badge">{data.unreadMessages}</span>}</button>)}</nav>
        <div className="router-mini"><div className="router-mini-top"><span className={data.connected ? "pulse" : "pulse offline"} /> {loading ? "Connecting" : data.connected ? "Router online" : "Router offline"}</div><strong>ZTE MF293N</strong><span>{data.softwareVersion || "Reading firmware"}</span><div className="router-shape"><i /><i /><i /></div></div>
        <div className="profile"><span className="avatar">AD</span><span><strong>{routerUsername}</strong><small>{hidden ? "Details protected" : "Details visible"}</small></span><button className="profile-action" onClick={logout}>Log out</button></div>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="page-note">{copy.note}</p></div><div className="top-actions"><span className={error ? "live-chip error" : loading ? "live-chip loading" : "live-chip"}><i />{error ? "Connection error" : loading ? "Connecting" : "Live device data"}</span><span className="updated">{data.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Waiting for device"}</span><button className="refresh" onClick={() => loadStatus(true)}>Refresh <span aria-hidden="true">R</span></button></div></header>
        {error && <div className="error-banner" role="alert"><strong>Router data unavailable</strong><span>{error}</span><button onClick={() => loadStatus(true)}>Try again</button></div>}
        {!error && active === "Overview" && <Overview data={data} history={history} hidden={hidden} setHidden={setHidden} choose={choose} />}
        {!error && active === "Network" && <><NetworkView data={data} hidden={hidden} setHidden={setHidden} requestAction={setPending} /><RadioControls requestAction={setPending} /></>}
        {!error && active === "Wi-Fi" && <WifiView data={data} requestAction={setPending} />}
        {!error && active === "Devices" && <DevicesView data={data} query={query} setQuery={setQuery} devices={visibleDevices} requestAction={setPending} />}
        {!error && active === "Messages" && <MessagesView data={data} requestAction={setPending} />}
        {!error && active === "System" && <SystemView data={data} hidden={hidden} setHidden={setHidden} requestAction={setPending} />}
      </section>
      {pending && <div className="modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!acting)setPending(null);}}><section className={pending.danger?"confirm-modal danger":"confirm-modal"} role="dialog" aria-modal="true" aria-labelledby="confirm-title"><span className="confirm-mark">{pending.danger?"!":"OK"}</span><p className="eyebrow">Review router change</p><h2 id="confirm-title">{pending.title}</h2><p>{pending.description}</p><div className="confirm-actions"><button disabled={acting} onClick={()=>setPending(null)}>Cancel</button><button className="confirm-primary" disabled={acting} onClick={applyAction}>{acting?"Applying...":pending.danger?"Confirm and continue":"Apply change"}</button></div></section></div>}
      {notice && <div className="toast" role="status"><span>OK</span>{notice}</div>}
    </main>
  );
}

function LoginScreen({checking,address,setAddress,username,setUsername,password,setPassword,error,loading,submit}:{checking:boolean;address:string;setAddress:(value:string)=>void;username:string;setUsername:(value:string)=>void;password:string;setPassword:(value:string)=>void;error:string;loading:boolean;submit:(event:FormEvent)=>void}) {
  return <main className="login-shell"><section className="login-story"><span className="login-brand"><span className="brand-mark"><i/><i/><i/></span>beacon</span><div><p className="eyebrow light">MF293N control center</p><h1>Your network,<br/>clearly in view.</h1><p>Sign in directly to the router to see live devices, Wi-Fi, carrier settings and system controls.</p></div><div className="login-route"><span>Router</span><i/><span>Local dashboard</span></div></section><section className="login-panel"><form className="login-card" onSubmit={submit}><p className="eyebrow">Secure local access</p><h2>{checking?"Checking session":"Sign in to your router"}</h2><p className="login-note">These credentials are kept only in the dashboard's server memory and sent to your local router.</p><label><span>Router address</span><input value={address} onChange={(e)=>setAddress(e.target.value)} disabled={checking||loading}/></label><label><span>Username</span><input value={username} onChange={(e)=>setUsername(e.target.value)} autoComplete="username" disabled={checking||loading}/></label><label><span>Password</span><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" autoFocus={!checking} disabled={checking||loading}/></label>{error&&<div className="login-error" role="alert">{error}</div>}<button className="login-submit" disabled={checking||loading||!username||!password}>{checking?"Checking...":loading?"Signing in...":"Open dashboard"}</button><small className="login-foot">Connection stays inside your local network.</small></form></section></main>;
}

function Overview({ data, history, hidden, setHidden, choose }: { data: RouterData; history: number[]; hidden: boolean; setHidden: (value: boolean) => void; choose: (item: string) => void }) {
  return <><div className="network-hero"><section className="hero-copy"><div className="status-line"><span className="status-dot" /> {data.connected ? "Internet connected" : "Internet disconnected"}</div><p className="hero-label">{data.provider} / {data.networkType} {data.band && data.band !== "--" ? `/ ${data.band}` : ""}</p><div className="speed-row"><div><span className="speed-arrow">D</span><strong>{formatSpeed(data.downloadMbps)}</strong><small>Mbps download</small></div><div><span className="speed-arrow up">U</span><strong>{formatSpeed(data.uploadMbps)}</strong><small>Mbps upload</small></div></div><div className="hero-foot"><span>WAN address</span><strong>{hidden ? maskIp(data.wanIp) : data.wanIp}</strong><button onClick={() => setHidden(!hidden)}>{hidden ? "Show" : "Hide"}</button></div></section><SignalCard data={data} /></div>
    <div className="path-strip" aria-label="Network path"><div className="path-node"><i className="node-cloud" /><span><small>Carrier</small><strong>{data.provider}</strong></span></div><span className="path-line active"><b>{data.networkType}</b></span><div className="path-node router"><i className="node-router" /><span><small>Gateway</small><strong>MF293N</strong></span></div><span className="path-line active"><b>Wi-Fi</b></span><div className="path-node"><i className="node-device" /><span><small>Clients</small><strong>{data.devices.length} online</strong></span></div><button onClick={() => choose("Network")}>Inspect path</button></div>
    <div className="content-grid"><section className="panel traffic-panel"><div className="panel-head"><div><p className="eyebrow">Since dashboard opened</p><h2>Live download activity</h2></div><span className="live-label">5 sec samples</span></div><ActivityChart history={history} /></section><section className="panel wifi-panel"><div className="panel-head compact"><div><p className="eyebrow">Wireless</p><h2>Wi-Fi</h2></div><span className="pill">Live</span></div><div className="wifi-name"><span>Network</span><strong>{data.ssid}</strong></div><div className="wifi-metrics"><div><span>Coverage</span><strong>{title(data.coverage)}</strong></div><div><span>Capacity</span><strong>{data.maxDevices} devices</strong></div></div><button className="wide-button" onClick={() => choose("Wi-Fi")}>View Wi-Fi <span>&gt;</span></button></section><section className="panel devices-panel"><div className="panel-head"><div><p className="eyebrow">Live clients</p><h2>Connected devices</h2></div><button className="text-button" onClick={() => choose("Devices")}>See all {data.devices.length} &gt;</button></div><DeviceList devices={data.devices} /></section><section className="panel health-panel"><div className="panel-head compact"><div><p className="eyebrow">System</p><h2>Router status</h2></div><span className="health-score live">{data.signalBars}/5</span></div><InfoRow label="Internet connection" value={data.connected ? "Connected" : "Disconnected"} good={data.connected} /><InfoRow label="Firmware" value={shortVersion(data.softwareVersion)} /><InfoRow label="Uptime" value={formatDuration(data.uptimeSeconds)} /><button className="wide-button muted" onClick={() => choose("System")}>System details <span>&gt;</span></button></section></div></>;
}

function NetworkView({ data, hidden, setHidden, requestAction }: { data: RouterData; hidden: boolean; setHidden: (value: boolean) => void; requestAction: (action: PendingAction) => void }) {
  const [profileName,setProfileName]=useState(data.apn.profileName); const [accessPoint,setAccessPoint]=useState(data.apn.accessPoint); const [authMode,setAuthMode]=useState(data.apn.authMode); const [apnUser,setApnUser]=useState(data.apn.username); const [apnPassword,setApnPassword]=useState("");
  useEffect(()=>{setProfileName(data.apn.profileName);setAccessPoint(data.apn.accessPoint);setAuthMode(data.apn.authMode);setApnUser(data.apn.username);},[data.apn.profileName,data.apn.accessPoint,data.apn.authMode,data.apn.username]);
  return <div className="detail-layout"><section className="panel feature-panel cellular"><div className="status-line"><span className="status-dot" /> {data.connected ? `${data.networkType} connected` : "Disconnected"}</div><p className="feature-kicker">Current cellular link</p><h2>{data.provider}</h2><p>{data.band || data.networkType} / channel {data.channel || "--"}</p><div className="radio-bars">{Array.from({length:12},(_,i)=><i key={i} style={{height:`${Math.max(12,Math.min(96,data.signalBars*18 + ((i*13)%24)-12))}%`}} />)}</div><div className="feature-foot"><span>Current signal</span><strong>{data.signalDbm} dBm</strong></div></section><section className="panel metric-panel"><p className="eyebrow">Live radio quality</p><h2>{signalQuality(data.signalDbm)}</h2><div className="metric-grid"><Metric label="SINR" value={number(data.sinr)} unit="dB" /><Metric label="RSRQ" value={number(data.rsrq)} unit="dB" /><Metric label="RSSI" value={number(data.rssi)} unit="dBm" /><Metric label="Channel" value={data.channel || "--"} unit="" /></div></section><section className="panel wide-panel"><div className="panel-head"><div><p className="eyebrow">Carrier profile</p><h2>APN settings</h2></div><span className="pill">Active profile</span></div><div className="settings-form"><label><span>Profile name</span><input value={profileName} onChange={(e)=>setProfileName(e.target.value)} /></label><label><span>Access point (APN)</span><input value={accessPoint} onChange={(e)=>setAccessPoint(e.target.value)} /></label><label><span>Authentication</span><select value={authMode} onChange={(e)=>setAuthMode(e.target.value)}><option value="none">None</option><option value="pap">PAP</option><option value="chap">CHAP</option></select></label><label><span>Username</span><input value={apnUser} onChange={(e)=>setApnUser(e.target.value)} /></label><label><span>Password</span><input type="password" value={apnPassword} onChange={(e)=>setApnPassword(e.target.value)} placeholder="Leave blank to keep current" /></label></div><div className="form-actions"><button className="subtle-action" onClick={()=>setHidden(!hidden)}>{hidden?"Reveal WAN address":"Protect WAN address"}</button><button className="wide-button fit" onClick={()=>requestAction({action:"apn_update",title:"Save carrier APN",description:"The router will save this APN as the active profile. Mobile data may disconnect briefly while the profile changes.",danger:true,payload:{profileName,accessPoint,authMode,username:apnUser,apnPassword,index:data.apn.index}})}>Save APN profile</button></div></section><section className="panel quick-panel"><p className="eyebrow">Connection controls</p><h2>{hidden?maskIp(data.wanIp):data.wanIp}</h2><p>Disconnect and reconnect the cellular session without restarting the router.</p><button className="wide-button" onClick={()=>requestAction({action:"network_reconnect",title:"Reconnect mobile data",description:"The router will briefly disconnect from the carrier and establish a new session. Internet access will be interrupted.",danger:true})}>Reconnect network</button></section></div>;
}

function WifiView({ data, requestAction }: { data: RouterData; requestAction: (action: PendingAction) => void }) {
  const [ssid,setSsid]=useState(data.ssid); const [passphrase,setPassphrase]=useState(""); const [coverage,setCoverage]=useState(data.coverage); const [maxDevices,setMaxDevices]=useState(data.maxDevices || 32);
  useEffect(()=>{setSsid(data.ssid);setCoverage(data.coverage);setMaxDevices(data.maxDevices||32);},[data.ssid,data.coverage,data.maxDevices]);
  return <div className="detail-layout"><section className="panel feature-panel wifi-feature"><p className="eyebrow light">Primary network</p><h2>{data.ssid}</h2><p>{data.devices.length} connected client{data.devices.length===1?"":"s"} on the current wireless network.</p><div className="wifi-orbit"><span>Wi-Fi</span><i /><i /><i /></div><div className="feature-foot"><span>Security</span><strong>{formatAuth(data.authMode)}</strong></div></section><section className="panel metric-panel"><div className="panel-head compact"><div><p className="eyebrow">Coverage</p><h2>{title(coverage)} range</h2></div><span className="pill">Editable</span></div><div className="segment-control">{["short","medium","long"].map((item)=><button key={item} className={coverage===item?"selected":""} onClick={()=>setCoverage(item)}>{title(item)}</button>)}</div><p className="helper-text">Longer range uses more power and may increase interference.</p></section><section className="panel wide-panel"><div className="panel-head"><div><p className="eyebrow">Primary wireless network</p><h2>Wi-Fi settings</h2></div><strong className="capacity-number">{data.devices.length}/{data.maxDevices}</strong></div><div className="settings-form wifi-settings"><label><span>Network name (SSID)</span><input value={ssid} maxLength={32} onChange={(e)=>setSsid(e.target.value)} /></label><label><span>New password</span><input type="password" value={passphrase} onChange={(e)=>setPassphrase(e.target.value)} placeholder="Leave blank to keep current" /></label><label><span>Maximum devices</span><input type="number" min="1" max="32" value={maxDevices} onChange={(e)=>setMaxDevices(Number(e.target.value))} /></label></div><div className="capacity-track"><i style={{width:`${data.maxDevices ? Math.max(1,data.devices.length/data.maxDevices*100) : 0}%`}} /></div><button className="wide-button fit align-right" onClick={()=>requestAction({action:"wifi_update",title:"Apply Wi-Fi settings",description:"Changing the SSID or password will disconnect every wireless device. You may need to reconnect this computer using the new details.",danger:true,payload:{ssid,passphrase,coverage:`${coverage}_mode`,maxDevices}})}>Apply Wi-Fi settings</button></section><section className="panel quick-panel"><p className="eyebrow">Current network</p><h2>{formatAuth(data.authMode)}</h2><div className="detail-table"><InfoRow label="Connected clients" value={String(data.devices.length)} /><InfoRow label="Local gateway" value={data.lanIp} /><InfoRow label="Monthly traffic" value={formatBytes(data.monthlyReceivedBytes+data.monthlySentBytes)} /></div></section></div>;
}

function DevicesView({ data, query, setQuery, devices, requestAction }: { data: RouterData; query: string; setQuery: (value: string) => void; devices: Device[]; requestAction: (action: PendingAction) => void }) {
  function rename(device: Device){const hostname=window.prompt("New device name",device.name);if(hostname&&hostname.trim()&&hostname.trim()!==device.name)requestAction({action:"device_rename",title:"Rename device",description:`Rename ${device.name} to ${hostname.trim()} in the router device list.`,payload:{macAddress:device.macAddress,hostname:hostname.trim()}});}
  return <div className="single-column"><section className="summary-row"><SummaryCard label="Online now" value={String(data.devices.length)} note="Router station list" /><SummaryCard label="Blocked" value={String(data.blockedDevices.length)} note="Wi-Fi deny list" /><SummaryCard label="Capacity" value={`${data.maxDevices ? Math.round(data.devices.length/data.maxDevices*100) : 0}%`} note={`${data.devices.length} of ${data.maxDevices}`} /></section><section className="panel device-manager"><div className="panel-head manager-head"><div><p className="eyebrow">Live station list</p><h2>Connected devices</h2></div><label className="search-box"><span className="sr-only">Search devices</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search devices" /></label></div><div className="device-table-head controls"><span>Device</span><span>Connection</span><span>Status</span><span>Controls</span></div>{devices.map((device)=><div className="device-table-row controls" key={device.macAddress}><span className="device-identity"><b className="device-mark">{device.mark}</b><span><strong>{device.name}</strong><small>{device.ipAddress}</small></span></span><span>{device.detail.split(" / ")[0]}</span><span className="device-activity"><i />{device.activity}</span><span className="row-actions"><button onClick={()=>rename(device)}>Rename</button><button className="block" onClick={()=>requestAction({action:"device_block",title:"Block device",description:`Block ${device.name} (${device.ipAddress}) from the Wi-Fi network. Its connection will stop immediately.`,danger:true,payload:{macAddress:device.macAddress,name:device.name,ipAddress:device.ipAddress}})}>Block</button></span></div>)}{devices.length===0&&<div className="empty-row">{query ? "No matching devices" : "No connected devices reported"}</div>}</section>{data.blockedDevices.length>0&&<section className="panel blocked-panel"><div className="panel-head"><div><p className="eyebrow">Access control</p><h2>Blocked devices</h2></div><span className="pill">{data.blockedDevices.length}</span></div>{data.blockedDevices.map((device)=><div className="blocked-row" key={device.macAddress}><span><strong>{device.name}</strong><small>{device.macAddress}</small></span><button onClick={()=>requestAction({action:"device_unblock",title:"Unblock device",description:`Allow ${device.name} to connect to Wi-Fi again.`,payload:{macAddress:device.macAddress,name:device.name}})}>Unblock</button></div>)}</section>}</div>;
}

function MessagesView({ data, requestAction }: { data: RouterData; requestAction: (action: PendingAction) => void }) {
  const [messages,setMessages]=useState<SmsMessage[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const [number,setNumber]=useState(""),[message,setMessage]=useState(""),[ussd,setUssd]=useState(""),[ussdResult,setUssdResult]=useState("");
  async function load(){setLoading(true);try{const response=await fetch("/api/router/communications",{cache:"no-store"});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"Unable to load messages");setMessages(result.messages||[]);setLoadError("");}catch(caught){setLoadError(caught instanceof Error?caught.message:"Unable to load messages");}finally{setLoading(false);}}
  useEffect(()=>{load();},[]);
  const refresh=()=>window.setTimeout(load,800);
  return <div className="communications-layout"><section className="panel sms-inbox"><div className="panel-head"><div><p className="eyebrow">SIM and router storage</p><h2>SMS inbox</h2></div><button className="text-button" onClick={load}>{loading?"Loading...":"Refresh"}</button></div>{loadError&&<div className="login-error">{loadError}</div>}<div className="sms-list">{messages.map((item)=><article className={item.unread?"sms-item unread":"sms-item"} key={item.id}><div className="sms-meta"><strong>{item.number}</strong><span>{item.time}</span></div><p>{item.content}</p><div className="row-actions">{item.unread&&<button onClick={()=>requestAction({endpoint:"communications",action:"sms_read",title:"Mark message as read",description:`Mark the message from ${item.number} as read on the router.`,payload:{id:item.id},onSuccess:refresh})}>Mark read</button>}<button className="block" onClick={()=>requestAction({endpoint:"communications",action:"sms_delete",title:"Delete SMS",description:`Permanently delete this message from ${item.number}.`,danger:true,payload:{id:item.id},onSuccess:refresh})}>Delete</button></div></article>)}{!loading&&!messages.length&&<div className="empty-row">No stored messages</div>}</div></section><section className="panel compose-panel"><p className="eyebrow">New message</p><h2>Send SMS</h2><label><span>Recipient</span><input value={number} onChange={(e)=>setNumber(e.target.value)} placeholder="Mobile number"/></label><label><span>Message</span><textarea value={message} onChange={(e)=>setMessage(e.target.value)} maxLength={765} placeholder="Type a message"/></label><button className="wide-button" disabled={!number||!message} onClick={()=>requestAction({endpoint:"communications",action:"sms_send",title:"Send SMS",description:`Send this message to ${number} using the router SIM. Carrier messaging charges may apply.`,danger:true,payload:{number,message},onSuccess:()=>{setMessage("");refresh();}})}>Review and send</button></section><section className="panel ussd-panel"><div><p className="eyebrow">Carrier service</p><h2>USSD terminal</h2><p>Run balance checks and carrier menus through the installed SIM.</p></div><div className="ussd-entry"><input value={ussd} onChange={(e)=>setUssd(e.target.value)} placeholder="Example: *100#"/><button disabled={!ussd} onClick={()=>requestAction({endpoint:"communications",action:"ussd_send",title:"Run USSD request",description:`Send ${ussd} to the mobile network.`,payload:{command:ussd},onSuccess:(result)=>{const response=result.response as {content?:string}|undefined;setUssdResult(response?.content||"Request completed without text");}})}>Send</button></div>{ussdResult&&<div className="ussd-response"><span>Network response</span><p>{ussdResult}</p><div className="ussd-entry"><input value={ussd} onChange={(e)=>setUssd(e.target.value)} placeholder="Reply"/><button onClick={()=>requestAction({endpoint:"communications",action:"ussd_reply",title:"Reply to USSD menu",description:"Send this reply to the active carrier menu.",payload:{command:ussd},onSuccess:(result)=>{const response=result.response as {content?:string}|undefined;setUssdResult(response?.content||"Request completed");}})}>Reply</button><button className="block" onClick={()=>requestAction({endpoint:"communications",action:"ussd_cancel",title:"End USSD session",description:"Cancel the active USSD session.",payload:{},onSuccess:()=>setUssdResult("")})}>End</button></div></div>}<small>{data.provider} / {data.networkType}</small></section></div>;
}

function RadioControls({requestAction}:{requestAction:(action:PendingAction)=>void}){
  const [radio,setRadio]=useState<{selectedBands:string[];availableBands:string[];current:{band:string;channel:string;pci:string;cellId:string};cellLockSupported:boolean;cellLockReason:string}|null>(null),[bands,setBands]=useState<string[]>([]),[error,setError]=useState("");
  async function load(){try{const response=await fetch("/api/router/radio",{cache:"no-store"});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"Unable to load radio controls");setRadio(result);setBands(result.selectedBands||[]);setError("");}catch(caught){setError(caught instanceof Error?caught.message:"Unable to load radio controls");}}
  useEffect(()=>{load();},[]);function toggle(band:string){setBands((current)=>current.includes(band)?current.filter((item)=>item!==band):[...current,band]);}
  return <div className="radio-control-grid"><section className="panel band-panel"><div className="panel-head"><div><p className="eyebrow">Verified firmware control</p><h2>LTE band lock</h2></div><span className="pill">{radio?`${bands.length} selected`:"Loading"}</span></div>{error&&<div className="login-error">{error}</div>}<div className="band-options">{(radio?.availableBands||["3","5","38","41"]).map((band)=><label key={band} className={bands.includes(band)?"selected":""}><input type="checkbox" checked={bands.includes(band)} onChange={()=>toggle(band)}/><span>Band {band}</span></label>)}</div><p className="helper-text">The router disconnects briefly, applies the selected LTE bands, then reconnects.</p><button className="wide-button fit" disabled={!bands.length} onClick={()=>requestAction({endpoint:"radio",action:"band_update",title:"Apply LTE band lock",description:`Restrict the modem to LTE band${bands.length===1?"":"s"} ${bands.join(", ")}. Mobile data will disconnect briefly.`,danger:true,payload:{bands},onSuccess:()=>window.setTimeout(load,1600)})}>Apply band selection</button></section><section className="panel cell-panel"><p className="eyebrow">Serving cell</p><h2>Cell identity</h2><div className="detail-table"><InfoRow label="Active band" value={radio?.current.band||"--"}/><InfoRow label="EARFCN / channel" value={radio?.current.channel||"--"}/><InfoRow label="PCI" value={radio?.current.pci||"--"}/><InfoRow label="Cell ID" value={radio?.current.cellId||"--"}/></div><div className="cell-lock-note"><strong>Cell lock unavailable</strong><p>{radio?.cellLockReason||"Checking firmware support..."}</p></div></section></div>;
}

function SystemView({ data, hidden, setHidden, requestAction }: { data: RouterData; hidden: boolean; setHidden: (value: boolean) => void; requestAction: (action: PendingAction) => void }) {
  return <div className="detail-layout system-layout"><section className="panel feature-panel system-feature"><p className="eyebrow light">Router</p><h2>ZTE MF293N</h2><p>{data.provider} {data.networkType} gateway</p><div className="system-router"><i /><i /><i /><b /></div><div className="feature-foot"><span>Connection</span><strong>{data.connected ? "Online" : "Offline"}</strong></div></section><section className="panel metric-panel"><p className="eyebrow">Software</p><h2>Firmware status</h2><div className="detail-table"><InfoRow label="Installed" value={data.softwareVersion} /><InfoRow label="Web UI" value={data.webVersion || "Not reported"} /><InfoRow label="Update method" value="Carrier OTA" /></div><button className="subtle-action" onClick={()=>requestAction({action:"ota_check",title:"Check for carrier update",description:"Ask the router to contact its configured carrier update service. This will not install an update automatically."})}>Check for updates</button></section><section className="panel wide-panel"><div className="panel-head"><div><p className="eyebrow">Device identity</p><h2>Hardware information</h2></div><button className="text-button" onClick={() => setHidden(!hidden)}>{hidden?"Show":"Hide"} protected values</button></div><div className="detail-table two-col"><InfoRow label="Hardware version" value={data.hardwareVersion} /><InfoRow label="Local address" value={data.lanIp} /><InfoRow label="Device identifier" value={hidden ? maskId(data.imei) : data.imei} /><InfoRow label="Current uptime" value={formatDuration(data.uptimeSeconds)} /></div></section><section className="panel quick-panel danger-safe"><p className="eyebrow">Maintenance</p><h2>System actions</h2><p>These controls act directly on the router and always require confirmation.</p><div className="stack-actions"><button className="wide-button muted" onClick={()=>requestAction({action:"clear_traffic",title:"Clear traffic counters",description:"Reset the router's current traffic statistics to zero. This cannot be undone.",danger:true})}>Clear traffic counters</button><button className="wide-button danger-button" onClick={()=>requestAction({action:"restart",title:"Restart router",description:"Restart the MF293N now. Wi-Fi and internet access will be unavailable for several minutes.",danger:true})}>Restart router</button></div></section></div>;
}

function SignalCard({ data }: { data: RouterData }) { return <section className="signal-card" aria-label="LTE signal quality"><div className="signal-head"><span>Signal quality</span><strong>{signalQuality(data.signalDbm)}</strong></div><div className="signal-visual"><div className="signal-rings"><i /><i /><i /><b /></div><div><strong>{data.signalDbm || "--"}</strong><span>dBm</span></div></div><div className="signal-data"><div><span>SINR</span><strong>{number(data.sinr)} dB</strong></div><div><span>RSRQ</span><strong>{number(data.rsrq)} dB</strong></div><div><span>Cell</span><strong>{data.cellId || "--"}</strong></div></div></section>; }
function ActivityChart({ history }: { history: number[] }) { const max=Math.max(1,...history); const values=[...Array(Math.max(0,24-history.length)).fill(0),...history]; return <><div className="chart" aria-label="Live download activity chart"><div className="chart-scale"><span>{max.toFixed(1)}</span><span>{(max/2).toFixed(1)}</span><span>0</span></div><div className="bars">{values.map((value,i)=><i key={i} style={{height:`${value ? Math.max(4,value/max*100) : 1}%`}} className={i>=24-history.length?"recent":""} />)}</div></div><div className="chart-foot"><span>Earlier</span><span /><span /><span /><span>Now</span></div></>; }
function DeviceList({ devices }: { devices: Device[] }) { return <div className="device-list compact">{devices.slice(0,3).map((device)=><div className="device-row" key={device.macAddress}><span className="device-mark">{device.mark}</span><span className="device-name"><strong>{device.name}</strong><small>{device.detail}</small></span><span className="device-activity"><i />Online</span></div>)}{devices.length===0&&<div className="empty-row small">No clients online</div>}</div>; }
function InfoRow({ label, value, good=false }: { label: string; value: string; good?: boolean }) { return <div className="health-item"><span>{label}</span><strong>{good&&<i />}{value || "--"}</strong></div>; }
function Metric({ label, value, unit }: { label: string; value: string; unit: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{unit}</small></div>; }
function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) { return <div className="summary-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function formatSpeed(value: number) { return value < 10 ? value.toFixed(2) : value.toFixed(1); }
function number(value: number) { return Number.isFinite(value) ? String(value) : "--"; }
function title(value: string) { return value ? value.charAt(0).toUpperCase()+value.slice(1) : "--"; }
function maskIp(value: string) { const parts=value.split("."); return parts.length===4?`${parts[0]}.xxx.xxx.${parts[3]}`:"--"; }
function maskId(value: string) { return value.length>7?`${value.slice(0,6)}${"*".repeat(value.length-9)}${value.slice(-3)}`:"--"; }
function shortVersion(value: string) { const match=value.match(/B\d+$/); return match?.[0] || value || "--"; }
function signalQuality(value: number) { if (!value) return "Unknown"; if(value>=-80)return"Excellent"; if(value>=-95)return"Good"; if(value>=-105)return"Fair"; return"Weak"; }
function formatDuration(seconds: number) { if(!seconds)return"0 min"; const days=Math.floor(seconds/86400);const hours=Math.floor(seconds%86400/3600);const minutes=Math.floor(seconds%3600/60);return days?`${days}d ${hours}h`:hours?`${hours}h ${minutes}m`:`${minutes} min`; }
function formatBytes(bytes: number) { if(!bytes)return"0 B"; const units=["B","KB","MB","GB","TB"];const index=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);return`${(bytes/1024**index).toFixed(index>1?1:0)} ${units[index]}`; }
function formatAuth(value: string) { return value==="WPA2PSK"?"WPA2 (AES)":value==="WPAPSKWPA2PSK"?"WPA/WPA2":value||"--"; }

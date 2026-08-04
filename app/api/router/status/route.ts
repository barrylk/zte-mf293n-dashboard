import { createRouterClient } from "../router-client";
import { getRouterSession } from "../session-store";

export const dynamic = "force-dynamic";

const statusCommands = ["loginfo","signalbar","network_type","network_provider","ppp_status","SSID1","station_mac","realtime_tx_thrpt","realtime_rx_thrpt","realtime_tx_bytes","realtime_rx_bytes","realtime_time","monthly_rx_bytes","monthly_tx_bytes","wifi_coverage","lan_ipaddr","wan_ipaddr","wa_inner_version","cr_version","hardware_version","web_version","imei","lte_rsrp","lte_rsrq","lte_snr","lte_rssi","lte_pci","cell_id","wan_active_band","wan_active_channel","lte_rsrp_1","lte_rsrp_2","lte_rsrp_3","lte_rsrp_4","lte_snr_1","lte_snr_2","lte_snr_3","lte_snr_4","battery_exist","battery_value","battery_temp","battery_charging","mode_main_state","tx_power","MAX_Access_num","AuthMode","sms_unread_num","ACL_mode","wifi_mac_black_list","wifi_hostname_black_list","user_ip_addr","apn_interface_version","profile_name_ui","m_profile_name","profile_name","wan_apn_ui","wan_apn","ppp_auth_mode_ui","ppp_auth_mode","ppp_username_ui","ppp_username","Current_index","apn_mode"].join(",");
function numeric(value: unknown){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
function string(value: unknown){return value==null?"":String(value);}
function initials(name:string){const letters=name.split(/[\s-_]+/).filter(Boolean).map((part)=>part[0]).join("").slice(0,2);return(letters||"DV").toUpperCase();}

export async function GET(request: Request) {
  const session = getRouterSession(request);
  if (!session) return Response.json({ ok:false, error:"Router login required" }, { status:401, headers:{"Cache-Control":"no-store"} });
  try {
    const router = createRouterClient(session);
    await router.ensureAuth();
    const [status,wifiResponse,lanResponse,namesResponse,radio] = await Promise.all([
      router.get(statusCommands), router.getParams({cmd:"station_list"}), router.getParams({cmd:"lan_station_list"}), router.getParams({cmd:"hostNameList"}), router.get("lte_band_lock,wcdma_band_lock,net_select"),
    ]);
    Object.assign(status,radio);
    const customNames = new Map<string,string>();
    const named = Array.isArray(namesResponse.devices) ? namesResponse.devices as Array<Record<string,unknown>> : [];
    for(const device of named){const mac=string(device.mac||device.mac_addr).toUpperCase();const name=string(device.hostname||device.name);if(mac&&name)customNames.set(mac,name);}
    const wifi = Array.isArray(wifiResponse.station_list) ? wifiResponse.station_list as Array<Record<string,unknown>> : [];
    const lanCandidate = lanResponse.lan_station_list ?? lanResponse.station_list;
    const lan = Array.isArray(lanCandidate) ? lanCandidate as Array<Record<string,unknown>> : [];
    const unique = new Map<string,{station:Record<string,unknown>;connection:string}>();
    for(const station of wifi){const mac=string(station.mac_addr||station.mac).toUpperCase();if(mac)unique.set(mac,{station,connection:"Wi-Fi"});}
    for(const station of lan){const mac=string(station.mac_addr||station.mac).toUpperCase();if(mac&&!unique.has(mac))unique.set(mac,{station,connection:"Ethernet"});}
    if(!unique.size){for(const mac of string(status.station_mac).split(";").filter(Boolean)){unique.set(mac.toUpperCase(),{station:{mac_addr:mac,hostname:`Device ${mac.slice(-5)}`,ip_addr:mac},connection:"Wi-Fi"});}}
    const devices = Array.from(unique.entries()).map(([mac,{station,connection}])=>{const name=customNames.get(mac)||string(station.hostname||station.host_name||station.name)||"Unknown device";const ip=string(station.ip_addr||station.ip);return{name,detail:`${connection} / ${ip}`,activity:"Connected",mark:initials(name),macAddress:mac,ipAddress:ip};});
    const blockedMacs=string(status.wifi_mac_black_list).split(";").filter(Boolean);const blockedNames=string(status.wifi_hostname_black_list).split(";");
    return Response.json({ok:true,updatedAt:new Date().toISOString(),connected:string(status.ppp_status)==="ppp_connected",networkType:string(status.network_type),provider:string(status.network_provider),signalBars:numeric(status.signalbar),signalDbm:numeric(status.lte_rsrp),sinr:numeric(status.lte_snr),rsrq:numeric(status.lte_rsrq),rssi:numeric(status.lte_rssi),physicalCell:string(status.lte_pci),cellId:string(status.cell_id),band:string(status.wan_active_band),channel:string(status.wan_active_channel),antennaChains:[1,2,3,4].map((id)=>({id,rsrp:numeric(status[`lte_rsrp_${id}`]),sinr:numeric(status[`lte_snr_${id}`])})),power:{source:string(status.mode_main_state)==="mode_power_on_charger"?"12V DC adapter":"External DC",batteryPresent:string(status.battery_exist)==="1",batteryPercent:numeric(status.battery_value),temperatureC:numeric(status.battery_temp),txPower:string(status.tx_power),wattsAvailable:false},downloadMbps:numeric(status.realtime_rx_thrpt)*8/1_000_000,uploadMbps:numeric(status.realtime_tx_thrpt)*8/1_000_000,receivedBytes:numeric(status.realtime_rx_bytes),sentBytes:numeric(status.realtime_tx_bytes),uptimeSeconds:numeric(status.realtime_time),monthlyReceivedBytes:numeric(status.monthly_rx_bytes),monthlySentBytes:numeric(status.monthly_tx_bytes),ssid:string(status.SSID1),coverage:string(status.wifi_coverage).replace("_mode",""),maxDevices:numeric(status.MAX_Access_num)||32,authMode:string(status.AuthMode),lanIp:string(status.lan_ipaddr),wanIp:string(status.wan_ipaddr),softwareVersion:string(status.wa_inner_version),hardwareVersion:string(status.hardware_version),webVersion:string(status.web_version),imei:string(status.imei),unreadMessages:numeric(status.sms_unread_num),userIpAddress:string(status.user_ip_addr),blockedDevices:blockedMacs.map((macAddress,index)=>({name:blockedNames[index]||"Blocked device",macAddress})),apn:{profileName:string(status.profile_name_ui)||string(status.m_profile_name)||string(status.profile_name),accessPoint:string(status.wan_apn_ui)||string(status.wan_apn),authMode:(string(status.ppp_auth_mode_ui)||string(status.ppp_auth_mode)||"none").toLowerCase(),username:string(status.ppp_username_ui)||string(status.ppp_username),index:string(status.Current_index)||"0",mode:string(status.apn_mode),interfaceVersion:numeric(status.apn_interface_version)},devices},{headers:{"Cache-Control":"no-store"}});
  } catch(error){const message=error instanceof Error?error.message:"Unable to reach router";return Response.json({ok:false,error:message,updatedAt:new Date().toISOString()},{status:502,headers:{"Cache-Control":"no-store"}});}
}

#!/bin/sh

# Beacon's tiny on-device telemetry and signal LED agent for the ZTE MF293N.
# Runtime output stays in tmpfs to avoid continuous writes to the router flash.

OUT=/tmp/beacon-system.json
CFG=/mnt/userdata/beacon-tools/led.conf
INTERVAL=3

GREEN=/sys/class/leds/led:net_green
WHITE=/sys/class/leds/led:net_white
RED=/sys/class/leds/led:net_red

mode=signal
brightness=160
good=-95
fair=-105
pulse=700

load_config() {
  mode=signal
  brightness=160
  good=-95
  fair=-105
  pulse=700
  if [ -r "$CFG" ]; then
    while IFS='=' read key value; do
      case "$key" in
        mode) case "$value" in signal|stock|off) mode="$value" ;; esac ;;
        brightness) case "$value" in ''|*[!0-9]*) ;; *) [ "$value" -ge 1 ] && [ "$value" -le 255 ] && brightness="$value" ;; esac ;;
        good) case "$value" in -[0-9]*|[0-9]*) good="$value" ;; esac ;;
        fair) case "$value" in -[0-9]*|[0-9]*) fair="$value" ;; esac ;;
        pulse) case "$value" in ''|*[!0-9]*) ;; *) [ "$value" -ge 150 ] && [ "$value" -le 5000 ] && pulse="$value" ;; esac ;;
      esac
    done < "$CFG"
  fi
}

led_off() {
  [ -w "$1/blink" ] && echo "0 0 0" > "$1/blink"
  [ -w "$1/brightness" ] && echo 0 > "$1/brightness"
}

led_steady() {
  led_off "$GREEN"; led_off "$WHITE"; led_off "$RED"
  [ -w "$1/blink" ] && echo "0 0 $brightness" > "$1/blink"
  [ -w "$1/brightness" ] && echo "$brightness" > "$1/brightness"
}

led_pulse() {
  led_off "$GREEN"; led_off "$WHITE"; led_off "$RED"
  [ -w "$1/blink" ] && echo "$pulse $pulse $brightness" > "$1/blink"
}

led_stock() {
  led_off "$GREEN"; led_off "$RED"
  [ -w "$GREEN/blink" ] && echo "0 0 255" > "$GREEN/blink"
  [ -w "$RED/blink" ] && echo "0 0 255" > "$RED/blink"
  [ -w "$WHITE/blink" ] && echo "500 1500 4" > "$WHITE/blink"
  [ -w "$WHITE/brightness" ] && echo 0 > "$WHITE/brightness"
}

apply_led() {
  rsrp="$1"
  led_state=stock
  led_color=firmware
  case "$mode" in
    off)
      led_off "$GREEN"; led_off "$WHITE"; led_off "$RED"
      led_state=off; led_color=off
      ;;
    stock)
      led_stock
      ;;
    signal)
      case "$rsrp" in
        -[0-9]*|[0-9]*)
          if [ "$rsrp" -ge "$good" ]; then
            led_steady "$GREEN"; led_state=steady; led_color=green
          elif [ "$rsrp" -ge "$fair" ]; then
            led_pulse "$WHITE"; led_state=pulse; led_color=white
          else
            led_pulse "$RED"; led_state=pulse; led_color=red
          fi
          ;;
        *) led_pulse "$RED"; led_state=pulse; led_color=red ;;
      esac
      ;;
  esac
}

prev_total=$(awk '/^cpu /{print $2+$3+$4+$5+$6+$7+$8+$9}' /proc/stat)
prev_idle=$(awk '/^cpu /{print $5+$6}' /proc/stat)

while :; do
  load_config
  sleep "$INTERVAL"

  total=$(awk '/^cpu /{print $2+$3+$4+$5+$6+$7+$8+$9}' /proc/stat)
  idle=$(awk '/^cpu /{print $5+$6}' /proc/stat)
  total_delta=$(expr "$total" - "$prev_total")
  idle_delta=$(expr "$idle" - "$prev_idle")
  if [ "$total_delta" -gt 0 ]; then cpu=$(awk -v t="$total_delta" -v i="$idle_delta" 'BEGIN{printf "%d",((t-i)*100/t)}'); else cpu=0; fi
  prev_total=$total
  prev_idle=$idle

  mem_total=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
  mem_free=$(awk '/^MemFree:/{print $2}' /proc/meminfo)
  buffers=$(awk '/^Buffers:/{print $2}' /proc/meminfo)
  cached=$(awk '/^Cached:/{print $2}' /proc/meminfo)
  mem_available=$(expr "$mem_free" + "$buffers" + "$cached")
  mem_used=$(expr "$mem_total" - "$mem_available")
  [ "$mem_total" -gt 0 ] && mem_percent=$(awk -v u="$mem_used" -v t="$mem_total" 'BEGIN{printf "%d",(u*100/t)}') || mem_percent=0

  set -- $(df -k /mnt/userdata | tail -1)
  storage_total=$2
  storage_used=$3
  storage_free=$4
  storage_percent=${5%%%}

  set -- $(cat /proc/loadavg)
  load1=$1
  uptime=$(cut -d. -f1 /proc/uptime)
  rsrp=$(cfg get lte_rsrp 2>/dev/null | tr -d '\r\n')
  apply_led "$rsrp"

  temp="$OUT.tmp"
  printf '{"ok":true,"updatedAt":%s,"cpu":{"percent":%s,"load1":%s},"memory":{"totalKb":%s,"usedKb":%s,"availableKb":%s,"percent":%s},"storage":{"mount":"/mnt/userdata","totalKb":%s,"usedKb":%s,"freeKb":%s,"percent":%s},"uptimeSeconds":%s,"led":{"supported":true,"mode":"%s","state":"%s","color":"%s","rsrp":%s,"brightness":%s,"goodThreshold":%s,"fairThreshold":%s,"pulseMs":%s,"channels":["net_green","net_white","net_red"]}}\n' "$(date +%s)" "$cpu" "$load1" "$mem_total" "$mem_used" "$mem_available" "$mem_percent" "$storage_total" "$storage_used" "$storage_free" "$storage_percent" "$uptime" "$mode" "$led_state" "$led_color" "${rsrp:--999}" "$brightness" "$good" "$fair" "$pulse" > "$temp"
  mv "$temp" "$OUT"
done

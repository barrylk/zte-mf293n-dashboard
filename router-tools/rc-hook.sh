
# BEACON_AGENT_BEGIN
if [ -x /mnt/userdata/beacon-tools/beacon-agent.sh ]; then
  ln -sf /tmp/beacon-system.json /mnt/userdata/beacon-web/beacon-system.json
  /mnt/userdata/beacon-tools/beacon-agent.sh >/tmp/beacon-agent.log 2>&1 &
fi
if [ -x /mnt/userdata/beacon-tools/beacon-ota ]; then
  /mnt/userdata/beacon-tools/beacon-ota >/tmp/beacon-ota.log 2>&1 &
fi
# BEACON_AGENT_END

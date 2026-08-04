
# BEACON_AGENT_BEGIN
if [ -x /mnt/userdata/beacon-tools/beacon-agent.sh ]; then
  ln -sf /tmp/beacon-system.json /mnt/userdata/beacon-web/beacon-system.json
  /mnt/userdata/beacon-tools/beacon-agent.sh >/tmp/beacon-agent.log 2>&1 &
fi
# BEACON_AGENT_END

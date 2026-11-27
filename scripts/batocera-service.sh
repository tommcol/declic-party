#!/bin/sh
# Install as /userdata/system/services/declic_party on Batocera v38+.
set -eu

jail=/media/NO_LABEL/serveur/debian
app=/opt/applications/declic-party
node=/opt/node22/bin/node
pidfile=/var/run/declic_party.pid
log=/userdata/system/declic-party.log

running() {
    [ -s "$pidfile" ] || return 1
    read -r pid < "$pidfile"
    case "$pid" in ''|*[!0-9]*) return 1 ;; esac
    [ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" = "$jail$app" ] &&
        tr '\000' '\n' < "/proc/$pid/cmdline" | grep -Fxq "$app/dev.mjs"
}

case "${1:-}" in
    start)
        if running; then exit 0; fi
        [ -x "$jail$node" ] && [ -f "$jail$app/node_modules/ws/package.json" ] ||
            { echo "Déclic Party : Node ou le module WebSocket introuvable dans $jail" >&2; exit 1; }
        mkdir -p "$jail/proc" "$jail/dev"
        [ -e "$jail/proc/self/status" ] || mount -t proc proc "$jail/proc"
        [ -c "$jail/dev/null" ] || mount -o bind /dev "$jail/dev"
        cd "$jail$app"
        nohup chroot "$jail" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin \
            "$node" "$app/dev.mjs" --port 3000 </dev/null >>"$log" 2>&1 &
        echo "$!" > "$pidfile"
        ;;
    stop)
        if running; then
            kill "$pid"
            remaining=20
            while running; do
                if [ "$remaining" -eq 0 ]; then
                    echo "Déclic Party : le serveur met trop longtemps à s’arrêter" >&2
                    exit 1
                fi
                sleep 1
                remaining=$((remaining - 1))
            done
        fi
        rm -f "$pidfile"
        ;;
    status)
        running
        ;;
    *)
        echo "Usage : $0 start|stop|status" >&2
        exit 2
        ;;
esac

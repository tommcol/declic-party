#!/bin/sh
set -eu

jail=/media/NO_LABEL/serveur/debian
app=/opt/applications/declic-party
node=/opt/node22/bin/node
service=/userdata/system/services/declic_party
log=/userdata/system/declic-party.log

in_debian() {
    chroot "$jail" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin "$@"
}

is_declic_process() {
    [ "$(readlink "/proc/$1/root" 2>/dev/null)" = "$jail" ] &&
        [ "$(tr '\000' ' ' < "/proc/$1/cmdline" 2>/dev/null)" = "$node $app/dev.mjs --port 3000 " ]
}

old_pid=
for proc in /proc/[0-9]*; do
    pid=${proc##*/}
    if is_declic_process "$pid"; then
        if [ -n "$old_pid" ]; then
            echo 'Plusieurs processus correspondent au serveur Déclic Party. Arrêt annulé.' >&2
            exit 1
        fi
        old_pid=$pid
    fi
done
if [ -z "$old_pid" ]; then
    echo 'Processus Node attendu introuvable. Processus en cours :' >&2
    ps | grep '[n]ode' >&2 || true
    exit 1
fi
echo "Déclic Party détecté, PID $old_pid"

if [ -x "$service" ] && [ -r /var/run/declic_party.pid ] &&
    [ "$(cat /var/run/declic_party.pid)" = "$old_pid" ] && "$service" status; then
    echo 'Relance via le service Batocera declic_party'
    "$service" stop
    "$service" start
else
    parent=$(awk '/^PPid:/ {print $2}' "/proc/$old_pid/status")
    parent_name=$(cat "/proc/$parent/comm" 2>/dev/null || true)
    case "$parent_name" in
        sh|ash|bash|dash|zsh|init|systemd|busybox|tmux*|sshd|screen|SCREEN) ;;
        *)
            echo "Lancement géré par $parent_name (PID $parent). Relancez le serveur via ce programme." >&2
            exit 1
            ;;
    esac
    cwd=$(readlink "/proc/$old_pid/cwd")
    data_dir=$(tr '\000' '\n' < "/proc/$old_pid/environ" | sed -n 's/^DECLIC_DATA_DIR=//p')
    cd "$cwd"
    echo "Relance de Node depuis $cwd"
    kill -TERM "$old_pid"
    remaining=20
    while is_declic_process "$old_pid"; do
        [ "$remaining" -gt 0 ] || { echo 'Le serveur est toujours en cours d’arrêt.' >&2; exit 1; }
        sleep 1
        remaining=$((remaining - 1))
    done
    nohup chroot "$jail" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin "DECLIC_DATA_DIR=$data_dir" \
        "$node" "$app/dev.mjs" --port 3000 </dev/null >>"$log" 2>&1 &
fi

remaining=20
while [ "$remaining" -gt 0 ]; do
    if in_debian "$node" "$app/scripts/check-local-library.mjs" >/tmp/declic-party-check.log 2>&1; then
        cat /tmp/declic-party-check.log
        exit 0
    fi
    sleep 1
    remaining=$((remaining - 1))
done
cat /tmp/declic-party-check.log >&2
tail -n 25 "$log" >&2
exit 1

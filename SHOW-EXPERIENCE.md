# Tester Déclic Party Show Experience sur Batocera

La version de soirée utilise le port 3000 dans `/opt/applications/declic-party`.
La version design utilise un second dossier et son propre stockage local.
Le port 3101 est proposé. S'il est déjà occupé, choisissez un autre port et remplacez 3101 dans la commande de démarrage et dans l'adresse.

## Installer

Depuis le terminal Batocera :

```sh
cd /media/NO_LABEL/serveur &&
chroot "$PWD/debian" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin /bin/sh -ec '
  node --version
  git clone --branch show-experience --single-branch https://github.com/tommcol/declic-party.git /opt/applications/declic-party-design
  cd /opt/applications/declic-party-design
  npm ci --omit=dev
'
```

## Démarrer

```sh
cd /media/NO_LABEL/serveur &&
chroot "$PWD/debian" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin /bin/sh -ec '
  cd /opt/applications/declic-party-design
  exec env DECLIC_DATA_DIR=/opt/applications/declic-party-design/.declic-local node dev.mjs --port 3101
'
```

Ouvrez [l'interface animateur](http://192.168.1.147:3101/)
et [l'écran TV](http://192.168.1.147:3101/tv) depuis le même réseau.
Créez la soirée dans la version design et rejoignez-la avec le code de cette nouvelle soirée.
Le serveur de jeu s'exécute avec Node.js. Les extraits issus de fournisseurs externes nécessitent leur propre connexion réseau.

## Arrêter et mettre à jour

Appuyez sur **Ctrl+C** dans le terminal où tourne la version design. Puis exécutez :

```sh
cd /media/NO_LABEL/serveur &&
chroot "$PWD/debian" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin /bin/sh -ec '
  cd /opt/applications/declic-party-design
  git pull --ff-only origin show-experience
  npm ci --omit=dev
'
```

Relancez ensuite la commande de démarrage.

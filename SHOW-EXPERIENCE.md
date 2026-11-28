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

## Chantier 01 — Accueil animateur Studio TV

L’accueil propose la création et la reprise d’une soirée, l’accès à la bibliothèque,
aux paramètres, à l’écran TV et à l’inscription des participants. À la fin d’une
partie, le bouton de reprise permet de choisir le jeu suivant. Les confirmations
de création et de fin de soirée restent celles de l’application. L’historique
des soirées est affiché comme indisponible jusqu’au chantier d’archivage.

Le décor, les polices et les styles sont servis par le serveur Node local.
La composition suit le cahier des charges du Studio TV et la référence complémentaire
du Grand Soir. Le prototype HTML Studio TV et la maquette graphique n’étaient
pas accessibles pour comparer le rendu exact. L’essai et la validation sur Batocera
restent à faire.

Contrôles réalisés sur le serveur Node local avec Chromium : états de la soirée,
création, reprise après une manche avec participant et score, confirmations,
choix du jeu suivant et accès aux autres écrans. L’accueil a été vérifié en
1920 × 1080, 1280 × 720, 820 × 900, 390 × 844, 320 × 640 et 740 × 415,
avec les requêtes externes bloquées. La commande `npm test` a exécuté
103 tests avec succès.

Après la mise à jour, ouvrez l’accueil au port 3101. Avec une soirée de test,
créez une soirée, rejoignez-la depuis un téléphone, jouez une manche, revenez à
l’accueil puis reprenez la soirée. Vérifiez que le participant et son score sont
toujours présents et que le bouton « Écran TV » ouvre le plateau.

### Revenir à la version précédente

Arrêtez uniquement le serveur design avec **Ctrl+C**, puis lancez :

```sh
cd /media/NO_LABEL/serveur &&
chroot "$PWD/debian" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin /bin/sh -ec '
  cd /opt/applications/declic-party-design
  git fetch origin refs/heads/backup/avant-studio-tv-ch01
  git switch --detach FETCH_HEAD
  exec env DECLIC_DATA_DIR=/opt/applications/declic-party-design/.declic-local node dev.mjs --port 3101
'
```

Ce démarrage réutilise les données locales de la version design. Pour retrouver le
Studio TV, arrêtez ce serveur, exécutez `git switch show-experience` dans le dossier
du dépôt, puis relancez la mise à jour et le démarrage ci-dessus.

## Chantier 02 — Corrections de l’inscription sur téléphone

Le formulaire garde le pseudo et l’avatar quand le code est erroné, que le
pseudo est déjà pris ou que la connexion échoue. Le choix de l’avatar se déplie
à la demande. Le bouton de connexion reste visible dès l’ouverture sur les
formats testés. Le QR préremplit toujours le code de soirée.

Le même navigateur peut reprendre l’identité du joueur après fermeture de
l’onglet. Le joueur revient au formulaire si son inscription est devenue
invalide ou si la soirée a été fermée pendant son absence.

Vérifications en local sous Node.js et Chromium : lien d’invitation, entrée
manuelle, code inconnu, pseudo en double, choix d’avatar, coupure de la liaison,
nouvel onglet et clôture de soirée. Le scan avec un téléphone sur le réseau
Batocera et la reprise après mise en veille restent à valider sur place.

## Chantier 03 — Salon et plateau TV Le Grand Soir

Le plateau illustré s’ouvre avec un coin fixe pour le QR, le code et le nombre
d’inscrits. Les arrivées ouvrent un projecteur, affichent l’avatar et son pseudo,
puis le salon montre jusqu’à six portraits récents et le nombre restant.
Les avatars sont ceux de l’inscription. Le vote et la roulette utilisent le
même plateau et gardent l’invitation visible pendant l’accueil.

« Entrer dans le décor » change la scène de la TV avant la sélection musicale.
« Voir les participants » déclenche la présentation sur la TV. Cette étape est
conservée dans la soirée connectée pour les TV ouvertes ou rechargées en cours
de préparation. Une fois le jeu préparé, son état fait à nouveau foi.
L’entracte et le retour au salon réutilisent le plateau principal. La pause
pendant une manche du Tyrolien garde son univers.

« Ambiance du plateau » active une boucle instrumentale locale et indépendante
sur le poste animateur. Elle est coupée par défaut et s’efface avant les
extraits de jeu. Les jingles et le réglage de réduction des animations restent
disponibles.

Contrôles Node.js 22 et Chromium en local : accès au décor, arrivée, code et QR
à 1080p et 4K, choix direct, vote sur deux téléphones, roulette arrêtée par un
joueur, changement de décor avant la playlist, rechargement de la TV,
présentation, entracte et retour au salon. La sortie audio, le scan à distance
et le rendu sur une TV branchée à Batocera restent à essayer sur place.

Pour revenir à la version précédente, utilisez `git switch --detach c08a318`
dans le dossier de design avant de redémarrer le serveur. Cette version
du plateau conserve le format du stockage local.

## Maintenir les deux versions

Les règles, les scores, le catalogue, les playlists et le serveur local évoluent
dans `main`. Les décors, thèmes, animations et avatars de Grand Soir sont
maintenus dans `show-experience`, principalement dans `public/show.js`,
`public/show.css` et les ressources graphiques associées. Les points de raccord
avec le moteur et le serveur transportent le thème et l’avatar entre les écrans.

Dans GitHub, **Actions → Synchroniser Show Experience** se lance après chaque
publication sur `main`. Pour le relancer manuellement, utilisez **Run workflow**
sur `main`. GitHub fusionne les changements, teste sous Node.js 22 puis publie
sur `show-experience` en cas de succès. En cas d’échec, une issue renvoie au journal.
La synchronisation GitHub est indépendante de la mise à jour sur Batocera.

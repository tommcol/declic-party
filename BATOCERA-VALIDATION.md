# Déclic Party — Mise à jour et retour arrière sur Batocera

Cette procédure concerne l’installation **Studio TV** dans
`/opt/applications/declic-party-design`, avec Node.js 22 et le port **3101**.
Le serveur de référence du port 3000 peut continuer à tourner. Les données
Studio TV se trouvent dans `.declic-local` quand le lancement utilise la
commande ci-dessous.

## 1. Arrêter Studio TV et sauvegarder

Si Studio TV tourne au premier plan, appuyez sur **Ctrl+C dans son terminal**.
S’il est lancé par un service, arrêtez ce service avant la copie. Attendez le
retour de l’invite. La base SQLite et ses fichiers associés doivent être au repos.

Depuis le terminal **Batocera**, exécutez ce bloc. Il cherche l’installation
Studio TV et s’arrête si le dossier est ambigu, si le chroot manque de
`/dev/null` ou si Git détecte des modifications suivies. Il conserve le commit
actuel et le dossier de données avant la mise à jour.

```bash
(
  set -e
  shopt -s nullglob
  dossiers=(/media/*/serveur/debian/opt/applications/declic-party-design/.git)
  if [ "${#dossiers[@]}" -ne 1 ]; then
    printf 'Installations Studio TV trouvées : %s\n' "${#dossiers[@]}" >&2
    exit 1
  fi
  debian="${dossiers[0]%/opt/applications/declic-party-design/.git}"
  if [ ! -c "$debian/dev/null" ]; then
    printf '%s\n' 'Le chroot Debian doit avoir /dev monté avant la mise à jour.' >&2
    exit 1
  fi
  chroot "$debian" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin /bin/sh -ec '
    cd /opt/applications/declic-party-design
    test -z "$(git status --porcelain --untracked-files=no)"
    sauvegarde="$(mktemp -d /opt/applications/declic-party-sauvegarde-XXXXXXXX)"
    git rev-parse HEAD > "$sauvegarde/commit"
    if [ -d .declic-local ]; then cp -a .declic-local "$sauvegarde/donnees"; fi
    printf "Sauvegarde : %s\n" "$sauvegarde"
    git fetch origin show-experience
    if [ "$(git branch --show-current)" != show-experience ]; then git switch show-experience; fi
    git merge --ff-only FETCH_HEAD
    npm ci --omit=dev
    node --version
    git log -1 --oneline
    exec env DECLIC_DATA_DIR="$PWD/.declic-local" node dev.mjs --port 3101
  '
)
```

**Résultat attendu** — Node affiche « Déclic Party — serveur local » sur 3101.
Gardez ce terminal ouvert. Depuis un appareil sur le même Wi-Fi, ouvrez
`http://ADRESSE-IP-BATOCERA:3101/`. Ouvrez la TV depuis la régie pour recevoir
le bon code de soirée. Si 3101 est déjà occupé, relancez après avoir arrêté
l’ancienne instance Studio TV. Un avertissement Node sur SQLite expérimental
peut apparaître.

## 2. Faire l’essai réel

1. Reprendre une soirée ou en créer une avec quatre personnes. Scanner le QR
   code avec Android et iPhone. Déconnecter puis reconnecter un téléphone.
2. Jouer un extrait réel. Vérifier le volume musique, ambiance et effets
   depuis la position d’écoute des invités. Essayer les commandes de pause.
3. Passer un jeu en équipe et un jeu individuel. Tester la révélation, une
   distinction de l’Assistant et un podium sur la télévision.
4. Pendant une manche d’essai, arrêter puis relancer Studio TV. Vérifier la
   reprise, le pseudo, l’avatar et les réponses déjà enregistrées.
5. Terminer la soirée puis ouvrir **Historique des soirées** depuis l’accueil.
   Vérifier le bilan et son export.

## 3. Revenir à la version précédente

Arrêtez Studio TV. Exécutez le bloc ci-dessous. Remplacez `CHEMIN_AFFICHE` par le chemin imprimé à l’étape 1.

```bash
(
  set -e
  shopt -s nullglob
  dossiers=(/media/*/serveur/debian/opt/applications/declic-party-design/.git)
  if [ "${#dossiers[@]}" -ne 1 ]; then
    printf 'Installations Studio TV trouvées : %s\n' "${#dossiers[@]}" >&2
    exit 1
  fi
  debian="${dossiers[0]%/opt/applications/declic-party-design/.git}"
  test -c "$debian/dev/null"
  chroot "$debian" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin /bin/sh -ec '
  cd /opt/applications/declic-party-design
  sauvegarde="$1"
  test -f "$sauvegarde/commit"
  test -z "$(git status --porcelain --untracked-files=no)"
  git switch --detach "$(cat "$sauvegarde/commit")"
  npm ci --omit=dev
  reprise="$(mktemp -d /opt/applications/declic-party-reprise-XXXXXXXX)"
  if [ -d "$sauvegarde/donnees" ]; then cp -a "$sauvegarde/donnees/." "$reprise/"; fi
  printf "Données de la version reprise : %s\n" "$reprise"
  exec env DECLIC_DATA_DIR="$reprise" node dev.mjs --port 3101
' sh CHEMIN_AFFICHE
)
```

Le retour arrière démarre avec une copie des données sauvegardées.
Les données de la version d’essai restent dans `.declic-local`. Une fois
l’ancienne version relancée, conservez le chemin « Données de la version
reprise » pour les prochains redémarrages de cette version.

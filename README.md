# Déclic Party

Jeu de soirée musical avec blind test en solo et jeux en équipe. Interface française, écran animateur et fenêtre publique.

Version publiée : https://declic-party.tommcolin.workers.dev/

## Jouer

L’accueil propose neuf jeux musicaux. Le mode solo est un blind test avec des extraits Deezer. En équipe, le Cinéma musical fait deviner un film ou une série à partir de sa musique.

### Nouveautés v0.3

- **Téléphone-buzzer** : choisir Téléphones puis « Buzzer · réponse orale ». Le premier appui reçu par le serveur interrompt l’extrait sur le PC ; l’animateur attribue le titre, l’artiste ou la réponse. Les règles de rebuzz et de reprise sont communes au clavier et au téléphone. Le réseau reste nécessaire et son délai peut influencer l’ordre de réception.
- **Écoute progressive** : choisir 1, 2, 5 puis 10 secondes. L’animateur déclenche chaque palier, depuis le début de l’extrait. La musique s’arrête automatiquement, puis les équipes peuvent répondre jusqu’à la fin du délai. Les points de réponse valent 100 %, 80 %, 60 %, puis 40 % ; pas de bonus de rapidité sur ces manches. Le bonus de série reste réglable. Les équipes peuvent retenter au palier suivant ; les réponses déjà gagnées gardent leurs points. Seules les questions de type audio utilisent ces paliers.
- **Paroles à compléter** : choisir ce défi puis préparer une question dans Mes questions. Importer un extrait chanté, écrire la phrase avec un blanc, les mots attendus et trois distracteurs, puis choisir la coupure (0,1 à 30 secondes). La lecture originale s’arrête à cet instant, même après un buzz ou une pause. Ce mode utilise les fichiers préparés par l’animateur, sans récupération automatique de paroles. Une démonstration instrumentale sur une chanson traditionnelle est disponible via Découverte.
- Correction de la reprise manuelle depuis une pause : elle reprend la manche active, sans tenter de charger une ancienne partie USB.


- **Catalogue musique Deezer** : recherche de titres et de playlists publiques, import par lien, écoute des extraits, sélection conservée dans le navigateur. Jusqu’à trois thèmes à mélanger : variété française, pop/rock, disco/dance, rap français, années 80, famille. Disponibilité des extraits selon Deezer ; maximum 30 secondes par question. Les playlists sont limitées aux 100 premiers titres.
- **Variantes** : titre, artiste, titre et artiste indépendants, pochette progressivement révélée, choix entre plusieurs titres d’un artiste, mélange de défis. La sélection peut privilégier les titres populaires ou moins connus.
- **USB / clavier** : 2 à 10 équipes et une touche par équipe. Premier buzzer prioritaire, arrêt de l’extrait, validation animateur. Titre et artiste peuvent être attribués à deux équipes différentes. Rebuzz immédiat, différé ou interdit jusqu’à la question suivante. Reprise automatique ou manuelle.
- **Téléphones** : code de huit caractères ou lien d’invitation, QCM ou réponse écrite. Titre et artiste corrigés séparément, accents et ponctuation ignorés, petites fautes tolérées. Cinq essais maximum à l’écrit, un seul en QCM. Son uniquement sur le PC animateur. Internet nécessaire.
- **Scores** : points titre/artiste réglables, bonus de rapidité et de série désactivables, bilan par manche et export JSON, classement et podium.
- **Effets** : accéléré ×1,35, ralenti ×0,7, écureuil ×1,8, lecture inversée ; image mystère progressivement défloutée. Vitesse et hauteur sont liées dans les effets audio.
- **Questions personnelles** : audio ou images importés dans IndexedDB sur le PC, texte et réponses alternatives, durée et points. Export JSON des questions sans les médias.
- **Cinéma musical** : identifier un film ou une série en écoutant un extrait de sa musique.

Ouvrir « Écran public », déplacer la fenêtre sur la TV puis passer en plein écran. La fenêtre TV et le PC utilisent le même navigateur et la même origine. Garder la fenêtre animateur active pour recevoir les touches des buzzers.

## Développement

Utiliser Node.js 22.12 ou ultérieur. Les tests et la compilation n’ont pas besoin de Wrangler.

```sh
npm ci
npm test
npm run dev
```

Ouvrir http://localhost:3000/ sur le serveur, ou http://192.168.1.147:3000/ depuis le réseau de Batocera. `npm run dev` et l’ancienne commande `node dev.mjs --port 3000` lancent le même Worker, avec les deux Durable Objects simulés localement par Wrangler. Les données locales sont conservées dans `.wrangler/state`, même après un arrêt. Les pages et scripts sont servis sans cache en développement. Le navigateur conserve sa clé animateur et ses fichiers personnels pour l’adresse utilisée. Les extraits Deezer nécessitent une connexion Internet et passent par le Worker local.

### Batocera

Dans le terminal **Batocera**, depuis le dossier qui contient `debian` (`/media/NO_LABEL/serveur` sur cette installation), mettre à jour le dépôt sans écraser de modifications locales et installer Wrangler dans Debian.

```sh
cd /media/NO_LABEL/serveur
chroot "$PWD/debian" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin /bin/sh -c '
  set -e
  cd /opt/applications/declic-party
  node --version
  git pull --ff-only origin main
  npm ci --include=dev
'
```

Arrêter le précédent serveur sur le port 3000. S’il tourne au premier plan dans son terminal, utiliser **Ctrl+C**. Sur Batocera v38 ou ultérieur, installer le service et activer son lancement au démarrage.

```sh
mkdir -p /userdata/system/services
cp debian/opt/applications/declic-party/scripts/batocera-service.sh /userdata/system/services/declic_party
chmod +x /userdata/system/services/declic_party
batocera-services enable declic_party
batocera-services start declic_party
```

Contrôler le démarrage avec `tail -n 30 /userdata/system/declic-party.log` et `curl -fsS http://127.0.0.1:3000/api/health`. Pour un autre emplacement de Debian, adapter `jail` dans le script installé. Après une mise à jour, arrêter puis redémarrer le service pour reconstruire le Worker.

### Production

```sh
npm ci
npm run deploy
```

`wrangler.jsonc` contient la configuration sans secret. Le build produit `dist/worker.mjs`, module autonome incluant l’interface. Seule la publication demande une authentification Cloudflare.

## Architecture

- `public/engine.js` : règles partagées, scores, historique et vue publique filtrée.
- `public/catalog.js` : variantes musicales et génération des QCM.
- `public/app.js` : interface, WebSocket et BroadcastChannel pour la TV.
- `public/audio.js` : décodage Web Audio, effets et fichiers locaux.
- `src/catalog.js` : accès Deezer, métadonnées mises en cache cinq minutes, validation des URL audio et diffusion sans stockage permanent des extraits.
- `src/worker.js` : ressources, salons et Durable Objects SQLite, autorisations et expiration.
- `tests/` : 28 tests sur les règles, réponses partielles, chronomètre, rebuzz, scores, confidentialité et variantes QCM.

Les solutions et alias sont exclus des messages publics avant révélation. Chaque téléphone reçoit uniquement son propre résultat partiel ; les points de tous sont publiés à la révélation. Les secrets animateur et équipe ne figurent pas dans les liens publics. Le serveur conserve un hash du secret animateur. Les salons expirent sous 24 heures.

## Limites connues

- Deezer est le seul catalogue connecté. Spotify et Apple Music ne sont pas intégrés.
- Pas de bandes-annonces vidéo, QR code intégré, mode LAN hors connexion ou prise en charge des buzzers exclusivement de type manette.
- Les modèles USB doivent émuler des touches. Aucun matériel physique ni groupe de 50 téléphones n’a été testé.
- Les médias personnels restent dans le navigateur : les réassocier après transfert des questions JSON. Maximum 30 Mo par fichier ; formats selon le navigateur. Les fichiers longs sont décodés en mémoire.
- En écoute continue, les extraits bouclent pendant la durée d’une manche ; l’écoute du catalogue joue une fois l’extrait. Le passage automatique après révélation prépare la question suivante ; l’animateur démarre ensuite l’extrait.
- La correction approximative tolère une ou deux différences selon la longueur, sans garantir toutes les variantes d’un nom.
- La reprise des anciennes parties v0.1 exige de créer une nouvelle soirée.
- Utiliser des contenus dont la diffusion est autorisée pour l’événement.

## Inspirations étudiées

Observation des parcours et des principes de jeu, sans reprendre les marques, graphismes ou sources : BuzzMySong, KaraFun Quiz, Kahoot et Wooclap. Les modes titre/artiste, les choix rapides, l’écran TV et le détail des scores ont guidé cette ébauche.

## GitHub

Dépôt : https://github.com/tommcol/declic-party

Les sources de la version publiée sont conservées dans ce dépôt. GitHub Actions exécute les tests et la compilation à chaque modification de `main` et pour les propositions de modification. Ce contrôle ne déploie pas l’application.

Le déploiement automatique est assuré par **Cloudflare Workers Builds**, relié à la branche `main` de ce dépôt :

1. Un changement est enregistré sur `main`.
2. Cloudflare récupère cette version et exécute `npm test && npm run build` avec Node 24.
3. Si les tests et la compilation réussissent, `npx wrangler deploy` publie le Worker existant `declic-party`.
4. Si une étape échoue, la publication s’arrête et la version déjà en ligne reste disponible.

Les autres branches ne publient pas le site de production ; les aperçus automatiques sont désactivés. Les résultats et journaux sont disponibles dans les builds Cloudflare et les vérifications du commit GitHub. GitHub Actions conserve en parallèle son contrôle des tests et de la compilation.

L’authentification de publication reste gérée par Cloudflare ; aucun jeton n’est stocké dans le dépôt. Pour un déploiement manuel depuis un poste authentifié, `npm run deploy` reste disponible.


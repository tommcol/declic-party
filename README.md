# Déclic ! — v0.3

Jeu de soirée musique et cinéma, avec une identité et un code indépendants. Interface française, écran animateur et fenêtre publique.

Version publiée : https://declic-party.tommcolin.workers.dev/

## Jouer

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
- **Cinéma** : démonstrations par emojis et questions personnelles, dont audio, répliques ou images. Les bandes-annonces vidéo ne sont pas encore connectées.

Ouvrir « Écran public », déplacer la fenêtre sur la TV puis passer en plein écran. La fenêtre TV et le PC utilisent le même navigateur et la même origine. Garder la fenêtre animateur active pour recevoir les touches des buzzers.

## Développement

Node 24 ou récent, sans dépendances pour construire et tester.

```sh
npm test
npm run build
npm run dev
```

Le serveur de développement simple sert l’interface et le mode USB avec les médias locaux. Les salons connectés et l’API musicale nécessitent le Worker Cloudflare.

```sh
npm run build
npx wrangler deploy
```

`wrangler.jsonc` contient la configuration sans secret. Le build produit `dist/worker.mjs`, module autonome incluant les ressources de l’interface. Wrangler nécessite une authentification sur un nouveau poste.

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

### Quiz prêts à jouer (v0.5.3)

« Les quiz » propose **5 995 questions françaises dans 12 grandes catégories et 213 sous-thèmes**. Le catalogue affiche d’abord les catégories : musique ; cinéma, séries et TV ; sport ; géographie et voyages ; histoire et civilisations ; sciences et technologies ; nature et animaux ; arts, livres et BD ; cuisine et boissons ; jeux vidéo ; célébrités et société ; culture générale et traditions. Cliquer sur une catégorie prépare directement un quiz général : toutes ses questions sont disponibles et la sélection varie les thèmes automatiquement. Les sujets précis restent accessibles dans « Personnaliser ce quiz (facultatif) » ou la recherche avancée. Aucun sous-thème n’est à choisir pour lancer une soirée classique. Le sélecteur d’ajout de thème dans la préparation reprend ces groupes, en respectant l’univers de la partie. Les catégories servent à ranger le catalogue ; les questions et les parties existantes sont conservées. Un aperçu permet à l’animateur de lire les questions et réponses avant de jouer.

Le premier catalogue de 746 questions est conservé. L’import élargi ajoute 5 249 questions d’une archive libre OpenQuizzDB ; ces nouvelles questions sont identifiées comme questions d’archive. Les filtres contrôlent format, doublons de formulation, temporalité repérable et thèmes exclus. Ils ne vérifient pas la vérité de chaque réponse. Les conditions et le rapport d’import figurent dans [les sources](data/SOURCES.md).

Les téléphones chargent uniquement un index de thèmes. Les questions des thèmes choisis sont récupérées à la demande par le PC animateur, puis les manches sont transmises au salon. Les textes ne dépendent d’aucune API tierce pendant le jeu. Ils fonctionnent en USB/clavier, QCM téléphone, réponse écrite ou buzzer téléphone.

Données : 5 954 questions OpenQuizzDB (CC BY-SA 4.0), 17 Qulture et 24 adaptations LearnClash (CC BY 4.0). Régénération : `node scripts/build-question-bank.mjs` (également exécutée par le build). Le mode de développement sert les mêmes packs JSON que le Worker. Les jeux de données et leurs adaptations restent réutilisables sous leurs licences respectives.

Le bouton **Quiz général · tout mélanger** prépare une partie à partir des 12 catégories et des 5 995 questions. La sélection varie les catégories et les sujets. Pour une partie de 10 questions, 10 packs seulement sont choisis puis chargés ; les 213 fichiers ne sont pas téléchargés au lancement. Les niveaux restent filtrables. Le blind test audio est accessible dans **Les musiques** et utilise l’API Deezer ; Spotify, Apple Music et les API vidéo ne sont pas intégrés.

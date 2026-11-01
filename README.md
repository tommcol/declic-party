# Déclic ! — v0.2

Jeu de soirée musique et cinéma, avec une identité et un code indépendants. Interface française, écran animateur et fenêtre publique.

Version publiée : https://declic-party.tommcolin.workers.dev/

## Jouer

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
- `tests/` : 18 tests sur les règles, réponses partielles, chronomètre, rebuzz, scores, confidentialité et variantes QCM.

Les solutions et alias sont exclus des messages publics avant révélation. Chaque téléphone reçoit uniquement son propre résultat partiel ; les points de tous sont publiés à la révélation. Les secrets animateur et équipe ne figurent pas dans les liens publics. Le serveur conserve un hash du secret animateur. Les salons expirent sous 24 heures.

## Limites connues

- Deezer est le seul catalogue connecté. Spotify et Apple Music ne sont pas intégrés.
- Pas de bandes-annonces vidéo, QR code intégré, mode LAN hors connexion ou prise en charge des buzzers exclusivement de type manette.
- Les modèles USB doivent émuler des touches. Aucun matériel physique ni groupe de 50 téléphones n’a été testé.
- Les médias personnels restent dans le navigateur : les réassocier après transfert des questions JSON. Maximum 30 Mo par fichier ; formats selon le navigateur. Les fichiers longs sont décodés en mémoire.
- Les extraits bouclent pendant la durée d’une manche ; l’écoute du catalogue joue une fois l’extrait. Le passage automatique après révélation prépare la question suivante ; l’animateur démarre ensuite l’extrait.
- La correction approximative tolère une ou deux différences selon la longueur, sans garantir toutes les variantes d’un nom.
- La reprise des anciennes parties v0.1 exige de créer une nouvelle soirée.
- Utiliser des contenus dont la diffusion est autorisée pour l’événement.

## Inspirations étudiées

Observation des parcours et des principes de jeu, sans reprendre les marques, graphismes ou sources : BuzzMySong, KaraFun Quiz, Kahoot et Wooclap. Les modes titre/artiste, les choix rapides, l’écran TV et le détail des scores ont guidé cette ébauche.

## GitHub

Dépôt : https://github.com/tommcol/declic-party

Les sources de la version publiée sont conservées dans ce dépôt. GitHub Actions exécute les tests et la compilation à chaque modification de `main` et pour les propositions de modification. Ce contrôle ne déploie pas l’application.

La publication Cloudflare actuelle reste disponible à l’adresse indiquée en haut. Le déploiement depuis un poste authentifié utilise `npm run deploy`. Le déploiement automatique depuis GitHub n’est pas encore configuré ; aucun jeton Cloudflare n’est stocké dans les sources.

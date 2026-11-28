# Déclic Party — Finalisation du Grand Soir

Périmètre convenu le 28 novembre 2026. Chantiers 03 à 09 sur `show-experience`,
installation locale Batocera et Node.js 22. Les chantiers 01 et 02 constituent
la référence validée. Point de départ vérifié sur GitHub : `e837ba1`.

## État vérifié et ordre de réalisation

| Lot | En place | Développement à poursuivre |
| --- | --- | --- |
| 03 · Salon et TV | QR local, compteur, avatars dans le salon et arrivées animées, jingles, décors de jeu, habillage de roulette et de vote, entracte et podium. | Unifier les transitions et les commandes de spectacle. Placer le QR à portée de scan, laisser le centre de la scène aux arrivées et cadrer la présentation des groupes nombreux. Vérifier la séquence salon, choix, lancement, entracte et cérémonie. |
| 04 · Régie | Déroulé de préparation, modes compatibles, commandes de jeu et d'équipes, aperçu du décor, conduite automatique et « Je joue aussi » pour les modes compatibles. | Réunir l'aperçu TV en direct et la console droite. Rendre distincts les contrôles Jeu et Spectacle, et créer un mixeur avec musique, ambiance et effets. Vérifier chaque parcours manuel, roulette et vote. |
| 05 · Musique | Recherche et filtres combinés, playlists personnalisées, contrôle de compatibilité au lancement, vérification par lots de 500 dans le navigateur, identifiants Deezer persistants dans SQLite. | Déplacer la progression des lots sur le serveur local. Planifier une nouvelle tentative pour les références invalides, gérer les réserves d'extraits en mémoire et vérifier les droits d'usage avant tout raccordement de source. Comparer la notoriété et la qualité du rapprochement des titres français. |
| 06 · Jeux | Dix entrées dans le sélecteur téléphone, chacune reliée à un univers. Plusieurs jeux partagent le moteur classique, avec des traitements propres à la Frise, au Bingo et au Tyrolien. | Tester le parcours complet sur les trois écrans pour chacun. Mutualiser l'interface et la conduite là où elles sont compatibles, puis travailler décors, transitions, effets audio et révélations jeu par jeu. |
| 07 · Avatars | 40 émojis et identité déjà transmise entre les écrans. | Produire 300 portraits illustrés par familles. Conserver les identifiants existants, partager les huit comportements visuels prévus et charger au besoin les visuels de la galerie. |
| 08 · Statistiques et assistant | Scores par jeu et par soirée, statistiques de manches, séries, meilleurs temps et classements. Les événements alimentent déjà des animations. | Calculer les indicateurs communs, distinguer inscrits, présents, répondants et absents, brancher les quatorze distinctions validées et proposer les commentaires depuis la régie locale. |
| 08 · Historique | Sauvegarde de la soirée active, reprise serveur, export du jeu en cours. | Sauvegarder un bilan durable avant la clôture ou le remplacement d'une soirée. Conserver les bilans par jeu, leurs playlists, participants et distinctions. Ajouter la consultation depuis l'entrée « Historique des soirées ». |
| 09 · Qualité | Suite Node, tests du serveur et contrôle de charge local reproductible. | Étendre les scénarios aux dix jeux en navigateur, rejouer sur les appareils de la soirée, mesurer les connexions longues et les coupures Wi-Fi, vérifier la 4K et l'audio réel sur Batocera. |

Ordre des dépendances : mesures et restauration → catalogue audio et journal de
soirée → données de régie et assistant → commandes audiovisuelles et interfaces
partagées → déclinaisons des dix jeux et production des avatars → validation
complète sur Batocera. Les recherches et les illustrations des univers peuvent
avancer pendant le travail sur le moteur.

### Chemin critique par jeu

| Jeu | Contrôle de bout en bout à ajouter |
| --- | --- |
| Blind test | Reconnaissance titre, artiste et double réponse, validation partielle, buzzer et reprise après pause. |
| Bingo | Même sélection sur les grilles privées, étapes de victoire simultanées, arrêt anticipé et conservation du résultat. |
| Frise | Ancre et années jouables, écart entre modes individuel et collectif, résultat personnel et départage. |
| Pochettes | Quatre visuels distincts, image manquante, lisibilité sur petit écran et secours au chargement. |
| Dernier survivant | Vie perdue, absence, égalité de fin et distinction entre classement de soirée et vainqueur du jeu. |
| Maillon faible | Sécurisation, vote, ex æquo et cas où personne ne vote. |
| Reprises | Deux sens de jeu, artiste d'origine exact, métadonnées et version lue au moment de la révélation. |
| Cinéma musical | Bon rapprochement morceau–œuvre, films/séries/génériques et cinq choix lisibles. |
| Tyrolien | Six équipes, changement de palier, chute, attaque et conservation du résultat individuel. |
| Une seconde pour trouver | Enchaînement des paliers 1, 2, 5 et 10 secondes, reprises et statuts de réponse. Le jeu est actuellement disponible. |

Le cahier des charges historique décrit huit jeux, le Tyrolien à quatre équipes
et un Bingo joué jusqu'au dernier extrait. La branche testée propose dix
entrées, le Tyrolien jusqu'à six équipes et l'arrêt du Bingo à un palier acquis.
Le chantier conserve ces comportements observés. La place définitive d'« Une
seconde pour trouver » et le détail du retour individuel de la Frise restent
des décisions produit.

### Direction proposée pour la validation

- **TV**. Plateau illustré bleu nuit et champagne. À l’arrivée, quelques
  portraits nommés entrent en lumière. Les arrivées groupées se lisent en une
  séquence courte. La roulette et le vote occupent la zone centrale, puis
  l'ouverture de l'univers précède la sélection musicale.
- **Régie**. Aperçu TV permanent sur ordinateur. À droite, trois vues
  Participants, Statistiques et Assistant. En bas, deux groupes autonomes
  Jeu et Spectacle. En mode « Je joue aussi », garder les réponses masquées.
- **Téléphone**. Conserver le parcours d'inscription validé. Une consigne,
  une action principale et la confirmation de réponse dans la zone visible.
  Le détail individuel se consulte à la révélation et entre les jeux.
- **Assistant local**. Alimenté par les événements fiables de la soirée.
  Les suggestions de commentaires, de relances et de distinctions sont privées
  dans la régie. Une action explicite de l'animateur diffuse une suggestion à
  l’antenne. La conduite automatique des séquences choisies est un réglage
  indépendant.

## Mesures initiales

- Catalogue servi par une base de test neuve : 5 380 références, dont 5 360
  datées et 5 380 avec des genres de classement. 537 comportent un champ
  œuvre renseigné. Zéro identifiant audio enregistré dans cette base
  de test neuve. Les fichiers SQLite de l'installation Batocera restent la
  source pour connaître la couverture audio réelle de l'utilisateur.
- Chromium : QR visible et absence de débordement horizontal du salon TV à
  1920 × 1080 et 3840 × 2160. Inscription et arrivée vues aux tailles
  390 × 844 et 820 × 1180. Ce contrôle porte sur le navigateur de travail.
- Node.js 22.23.5 : 103 tests réussis. L'intégration existante teste notamment
  la reprise de la soirée, des réponses et des scores après redémarrage. Elle
  vérifie maintenant aussi la remontée des réponses groupées vers la TV.
- `node scripts/check-local-load.mjs` : salon sur port local temporaire, base
  isolée par palier, TV et régie présentes, inscription et réponses simultanées
  pour 4, 10, 30, 50, 100, 200 et 300 participants. Une question QCM
  synthétique par palier, moitié de réponses correctes. Contrôles des
  confirmations, des bons résultats et du masquage de la solution jusqu'à la
  révélation. Le scénario mesure les messages applicatifs reçus, hors audio.

La régie et la TV recevaient une copie complète de la manche après chaque
réponse. Elles reçoivent désormais la dernière mise à jour d'un groupe de
réponses sur une fenêtre de 75 ms. Le joueur reçoit toujours sa confirmation
après l'enregistrement de sa réponse. Au palier de 300 joueurs, le premier
essai local est passé de 120,5 à 49,2 Mio de messages et de 2,73 à 1,97 s
pour que 95 % des confirmations arrivent. Les 300 réponses ont été confirmées
dans les deux cas. Le contrôle rejoué avec le script du dépôt a mesuré 1,88 s
et 49,2 Mio. Ces chiffres mesurent un pic sur la machine de travail.

À vérifier sur le réseau réel : Android et iPhone, écrans TV et sortie audio,
veille et reconnexion, coupures du fournisseur, parties longues et débit
pendant les grands mouvements de classement.

## Actualiser Batocera et revenir au point de départ

Utiliser le terminal Batocera. Arrêter le serveur de design au préalable
avec `Ctrl+C` dans le terminal où il tourne. Ces commandes visent le dossier
de design et le port 3101. La procédure d'installation complète est dans
[SHOW-EXPERIENCE.md](SHOW-EXPERIENCE.md).

```sh
cd /media/NO_LABEL/serveur &&
debian="$PWD/debian" &&
{ [ -c "$debian/dev/null" ] || mount --bind /dev "$debian/dev"; } &&
chroot "$debian" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin /bin/sh -ec '
  cd /opt/applications/declic-party-design
  git switch show-experience
  git pull --ff-only origin show-experience
  npm ci --omit=dev
  git --no-pager log -1 --oneline
  exec env DECLIC_DATA_DIR="$PWD/.declic-local" node dev.mjs --port 3101
'
```

Pour revenir à la version validée des chantiers 01 et 02, reprendre le bloc
avec `git switch --detach e837ba1` à la place des deux commandes `git switch`
et `git pull`. Le lot de charge conserve le format des données locales.

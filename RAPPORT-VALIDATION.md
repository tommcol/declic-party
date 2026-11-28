# Déclic Party — Rapport de validation locale

**28 novembre 2026 · Show Experience · Version candidate pour essai réel**

Le point de départ est le commit `59ef565`. La version candidate a été
exécutée avec Node.js **22.23.5**, SQLite local et Chromium **158** dans un
environnement Linux x86-64. Le poste d’essai utilisait Debian 13 et un
processeur AMD EPYC 9V74. La configuration Batocera de la soirée utilise
Debian 12 dans son chroot. Les mesures du rapport décrivent le poste d’essai.

## Tests réussis

La suite Node.js a exécuté **112 tests, 112 réussis**. Le test d’intégration
ouvre un vrai serveur HTTP et WebSocket, écrit dans SQLite et rouvre ensuite
le même dossier de données.

| Domaine | Ce qui a été vérifié |
|---|---|
| Soirée et participants | Création, conflits entre onglets, reprise, inscription, avatar accepté et valeur hors catalogue écartée, conservation des joueurs et des accès lors d’un changement de jeu. |
| Équipes | Constitution des groupes, conflit d’inscription à la dernière place, attribution manuelle ou automatique, styles, verrouillage pendant la manche. Le Tyrolien a été joué avec six équipes via WebSocket. |
| Blind test | QCM, saisie, réponse orale et saisie titre + artiste dans le moteur. Inscription, réponse et révélation contrôlées dans Chromium. |
| Bingo et Frise | Grilles distinctes, validation de la première ligne, étapes et départages du Bingo. Placement collectif et individuel, dates égales et bilan après une fin anticipée pour la Frise. |
| Bonne pochette, Reprises, Cinéma | Pochettes distinctes, lecture privée du choix et affichage après révélation. Identification de l’interprète ou de l’œuvre, QCM et variantes de génériques sur données de test. |
| Dernier survivant, Maillon faible, Tyrolien | Vies, élimination, mode spectateur, sécurisation, confidentialité du vote, déplacement, égalité, attaque et chute. |
| Catalogue, votes et son | Recherche, filtres combinés, playlists enregistrées, vote de catégorie et choix de playlist. Durées audio simulées, volumes indépendants, indisponibilité HTTP et récupération sans ancien extrait. |
| Régie et télévision | Aperçu TV, compteurs et changements de phase, rendu du podium, diffusion d’une suggestion depuis l’assistant. Les joueurs gardent un écran de réponse distinct de la TV. |
| Statistiques et distinctions | Réponse orale et partielle, médiane, égalités, plafond de 100 points de soirée par jeu et séparation des scores de jeu. Certaines distinctions et animations n’ont pas été vérifiées individuellement sur les trois écrans. |
| Reprise et archive | Reconnexion du joueur avec le même identifiant après redémarrage du serveur Node, reprise des réponses et de l’alarme de révélation. Archivage, réouverture de l’archive après redémarrage, absence du jeton animateur et absence de doublon lors d’une opération reprise. |

Le test Chromium a utilisé quatre pages simultanées. La régie était en
1440 × 900, le téléphone émulé en 390 × 844, la tablette en 768 × 1024.
La TV a été vérifiée en 1920 × 1080 et 3840 × 2160. Aucun débordement
horizontal n’a été constaté sur le téléphone et la TV aux dimensions vérifiées par le scénario.
Le parcours a contrôlé le formulaire d’inscription par code et par lien,
la réponse, la révélation, l’assistant et l’accès aux archives depuis l’accueil.
Un relevé de 60 images du podium dans Chromium donne un intervalle médian de
16,7 ms en Full HD et en 4K, avec un P95 respectif de 50,0 ms et 16,8 ms.
Ces mesures courtes portent sur le navigateur sans écran physique et ont été
effectuées séparément de la charge à 300.

## Tests échoués au départ et corrections vérifiées

- **Reprise et changement de jeu** — Deux tests échouaient parce que les
  environnements de test du serveur ne chargeaient pas les fonctions
  ajoutées avec les archives et le barème. Les tests appellent désormais ces
  fonctions réelles et vérifient le score brut ainsi que le score de soirée.
- **Anciennes réponses partielles** — Un résultat sans type de question,
  avec une partie trouvée et un verdict faux, était compté complet. Il est
  désormais classé partiel.
- **Historique depuis l’accueil** — La tuile était désactivée après la
  fermeture d’une soirée. Elle ouvre maintenant les archives.
- **Podium TV** — Le texte du premier podium gardait une couleur sombre sur
  un fond sombre. Le contraste a été corrigé et contrôlé dans Chromium.
- **Audio indisponible** — Le tampon du morceau précédent subsistait après
  un échec de chargement. Le lecteur vide le tampon au changement de morceau.
- **Rafales de réponses** — Le traitement copie la réponse modifiée au lieu
  de recopier toute la partie. SQLite sérialise chaque écriture préparée
  une seule fois et confirme toujours les réponses après validation de
  la transaction.

## Mesures de charge

Une session neuve par palier, avec une régie, une TV et de 4 à 300 clients
WebSocket simulés. Tous les joueurs s’inscrivent, puis répondent en rafale
à la même manche. Le test vérifie le nombre d’accusés de réception,
les bonnes réponses, l’absence d’erreur du serveur et une révision identique
entre régie et TV. P95 signifie que 95 % des observations sont au plus à
cette durée. CPU et RSS couvrent le processus Node de test, qui héberge aussi
les clients simulés. Le trafic cumule inscription et manche. Un essai par
palier, sur réseau local à la machine.

| Joueurs | Confirmées | Inscription P95 (ms) | Réponse médiane / P95 / max. (ms) | Régie / TV (ms) | CPU (ms) | RSS (Mio) | Trafic (Mio) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 4 | 4 | 12.1 | 4.2 / 4.3 / 4.3 | 77.6 / 77.7 | 6 | 134.2 | 0.1 |
| 10 | 10 | 16 | 9.2 / 9.5 / 9.5 | 79.9 / 80.1 | 11.7 | 151.7 | 0.2 |
| 30 | 30 | 69 | 24.4 / 25.1 / 25.1 | 78 / 78.2 | 33.5 | 126.1 | 0.8 |
| 50 | 50 | 55 | 49.5 / 51.1 / 51.2 | 81.8 / 82 | 98.1 | 138.4 | 1.8 |
| 100 | 100 | 145.5 | 158.8 / 164.9 / 165.6 | 166.2 / 166.5 | 230.9 | 165.1 | 6.3 |
| 200 | 200 | 413.3 | 461.6 / 472.1 / 473.1 | 474.1 / 474.4 | 545.3 | 202.1 | 23.4 |
| 300 | 300 | 670.7 | 999 / 1035.2 / 1039.1 | 1043.3 / 1044.4 | 1220.3 | 310 | 51.2 |

Sur Node.js 22.23.5, le P95 des réponses à 300 joueurs est passé de
1 671,7 ms avant correction à 1 035,2 ms dans l’essai final, soit 38 % de
moins pour ces deux mesures. La dernière confirmation est arrivée à
1 039,1 ms et les deux écrans ont affiché l’état complet à environ 1 044 ms.

## Limites et essais encore nécessaires

- Appareils physiques Android, iPhone, tablettes et TV, Safari/WebKit et
  Firefox, et environnement Batocera. Chromium a permis une émulation des
  dimensions, pas une vérification de ces systèmes.
- Scan du QR code avec une caméra, Wi-Fi de la salle, pertes réseau
  prolongées, arrêt électrique, buzzers USB matériels et sortie audio HDMI.
- Disponibilité des extraits du fournisseur, équilibre sonore dans la pièce
  et changement d’extrait pendant une panne réelle.
- Partie complète de chacun des neuf jeux sur les trois appareils et
  vérification visuelle de chaque décor, animation, podium et distinction.
  Les essais de charge couvrent une manche QCM, pas tous les jeux ni une longue
  soirée. La lisibilité depuis le fond de la salle reste à vérifier.

## Reproduire les contrôles

```sh
npm ci --omit=dev
npm test
node scripts/check-local-load.mjs
DECLIC_CHROMIUM=/chemin/vers/chromium node scripts/check-local-browser.mjs
```

Voir [la mise à jour et le retour arrière sur Batocera](BATOCERA-VALIDATION.md).
La validation définitive dépend de vos essais en conditions réelles.

# Déclic Party — Blind test

## La soirée

Application de jeux exclusivement musicaux, destinée aux soirées. L’animateur crée ou reprend sa soirée, invite par code ou QR code et choisit un jeu. L’écran collectif est lisible en 16:9 à distance. Les participants répondent sur leur téléphone et retrouvent leur identité après reconnexion. La salle reçoit le son depuis le poste de l’animateur. Les animations servent les transitions, les résultats et les podiums, avec respect du réglage de réduction des animations.

La cible est de 300 joueurs simultanés, en plus de l’animateur et de l’écran collectif. Le serveur arbitre les délais, les réponses, les scores et les changements de manche. Les écrans collectifs montrent des agrégats et des classements courts. Les tests de charge s’effectuent hors production.

## Jeux validés

| Jeu | Déroulement validé |
| --- | --- |
| 1. Le Tyrolien | Blind test en 2 à 4 équipes. Le classement des manches prend en compte le pourcentage de bonnes réponses et le temps de réponse. Les équipes avancent ou reculent sur les paliers suivant les règles du Tyrolien. L’attaque peut entraîner une élimination au sommet. L’équipe gagnante vote lorsqu’une cible doit être choisie. Le bonus propre au jeu s’obtient après quatre premières places consécutives. Les joueurs éliminés continuent à jouer pour le classement individuel. |
| 2. Bingo musical | Le logiciel tire 16 chansons de la sélection et donne les mêmes chansons à tous, dans un ordre différent sur chaque grille 4 × 4. L’animateur choisit de reconnaître le titre ou l’artiste. La réponse se fait directement sur la grille pendant l’extrait. À la révélation le titre joué est coché pour tout le monde. Bingo, Double Bingo et Triple Bingo récompensent une, deux puis trois combinaisons de lignes et de colonnes, diagonales exclues. Les ex æquo sont déterminés au tirage. La partie continue pour tous jusqu’au seizième extrait, sans récompense de carton plein. L’écran collectif affiche le joueur correct le plus rapide et les nombres de bonnes et mauvaises réponses. |
| 3. Frise musicale | Deux modes validés, individuel et collectif. Cinq choix de placement au maximum. En individuel, les joueurs construisent leur frise et l’écran collectif présente la répartition globale par nombre de placements corrects. Le téléphone ne révèle pas individuellement quels placements étaient corrects. En collectif, la même frise est visible sur les téléphones et l’écran collectif. Les extraits se jouent l’un après l’autre jusqu’à leur fin. |
| 4. La bonne pochette | Reconnaître la pochette associée à l’extrait parmi des pochettes d’artistes ou de morceaux différents. Aucun nom d’artiste comme libellé des choix. Après l’extrait, montrer les bonnes et mauvaises réponses et le joueur correct le plus rapide. |
| 5. Dernier survivant | Une playlist, un tirage aléatoire, titre ou artiste, et quatre propositions. L’animateur règle de 1 à 5 vies, avec 3 par défaut. Une mauvaise réponse ou une absence coûte une vie dans ce jeu. Les éliminés continuent pour le classement de la soirée. Si tous les derniers survivants tombent à zéro ensemble, ils repartent à une vie pour le départage. |
| 6. Les reprises | Écouter une reprise et retrouver l’interprète de la version originale, ou écouter l’original et retrouver l’interprète de la reprise. |
| 7. Cinéma musical | Reconnaître uniquement le film, la série, le dessin animé ou l’émission. Sélection d’une ou plusieurs playlists, 2 à 5 propositions. |
| 8. Blind test classique | L’animateur choisit les playlists et le mode titre, artiste ou titre et artiste. |

Les derniers échanges nomment le Blind test classique comme jeu 8. Une liste antérieure annonçait neuf jeux. Le retrait du jeu proposé avant le Dernier survivant et le maintien du Tyrolien sont confirmés. Aucun neuvième jeu supplémentaire n’est identifié dans les décisions finales consultées.

## Musiques, statistiques et bonus

- Réutiliser une bibliothèque musicale et un moteur communs pour choisir, lire et arrêter les extraits. Le code des jeux reste indépendant du fournisseur. Utiliser la durée disponible de l’extrait dans les modes où elle règle la manche.
- Conserver les 37 playlists de référence, les métadonnées, les exclusions manuelles et la déduplication. Le catalogue maître consulté compte 2 143 références et déclare 0 extrait validé. Les métadonnées et un extrait effectivement jouable représentent deux étapes distinctes du contrôle.
- Maintenir les statistiques de chaque joueur sur la soirée et rendre les résultats consultables notamment aux pauses et en fin de soirée.
- Un joueur peut détenir un seul joker. Le seuil validé est quatre bonnes réponses de suite ou deux premières réponses correctes les plus rapides de suite. Le Tyrolien garde son mécanisme propre. Les vies du Dernier survivant relèvent de la mécanique du jeu. Les autres jeux n’ajoutent aucun malus transversal.
- L’animateur peut activer les jokers au lancement. Attribution aléatoire parmi les jokers compatibles, compteurs suspendus pendant la possession, remise à zéro à l’utilisation. Le joker expire au changement de jeu.
- Bingo : récompenses automatiques Éclair et Combo, avec grille inchangée. Frise : indice décennie et double points. Pochettes : 50/50 et seconde chance. Dernier survivant : vie supplémentaire, bouclier et 50/50. Reprises : 50/50, seconde chance et double points. Cinéma : 50/50 et double points. Blind test : double points et seconde chance selon le mode de réponse. Tyrolien : système propre.
- Le barème général équilibré entre jeux reste à valider. Les statistiques brutes demeurent indépendantes des effets des jokers.

## État des développements

| Partie | État |
| --- | --- |
| Accueil, invitations, trois écrans et Tyrolien | Présents avant cette intervention. |
| Bingo | Grilles privées de 16 titres, réponse verrouillée pendant l’écoute, cochage automatique à la révélation, régie de suivi et résultats par étape. |
| Dernier survivant | Vies configurables, départage tant qu’il reste un extrait, joueurs éliminés toujours actifs et bilan par nombre de vies. |
| Pochettes, reprises et cinéma | QCM par pochettes et bilan collectif. Deux sens de recherche pour les reprises. Sélection groupée films, séries et génériques avec 2 à 5 propositions. |
| Statistiques de soirée | Cumul serveur des scores et bonnes réponses entre jeux en mode connecté. Le détail et les indicateurs de soirée restent à compléter. |
| Frise | Deux modes jouables, ajout automatique ou après réussite, départage au temps et répartition collective. La sélection repose encore sur les extraits datés du catalogue de départ. |
| Moteur musical et playlists | Bibliothèque de référence enrichie avec les métadonnées du catalogue maître, recherche Deezer et extraits de démonstration. La sélection d’une à cinq playlists recherche des extraits Deezer correspondants à la demande. La validation audio exhaustive titre par titre reste à faire. Les années signalées comme incertaines sont masquées dans le catalogue. |
| Joker commun | Attribution serveur, progression privée et effets selon le type de jeu. Les récompenses automatiques avancées et le détail de l’historique par type restent à compléter. |

La liste des conversations du projet est accessible. Le texte complet de plusieurs réponses anciennes n’a pas été récupéré au moment de cette version, ainsi que le contenu complet de tous les fichiers historiques. Les divergences de règles non résolues doivent être comparées aux conversations sources avant d’étendre le comportement.

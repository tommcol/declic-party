# Déclic Party · Audit des écrans et des mécaniques

Revue de la branche show-experience et des deux captures du 28 novembre 2026. Le tableau indique ce que le code permet de vérifier. Les parcours sur les appareils de la soirée restent à valider en conditions réelles.

## Parcours commun

| Moment | TV | Régie | Téléphone |
| --- | --- | --- | --- |
| Salon sans jeu préparé | Grand Soir, QR et arrivées | Invitation et choix du jeu | Connexion et avatar |
| Jeu préparé | Décor du jeu dès la présentation | Aperçu du décor et commandes du jeu | Attente du lancement |
| Écoute ou question | Consigne, extrait et progression | Chrono et conduite manuelle ou automatique selon le mode | Une action principale selon le jeu |
| Révélation | Une zone lisible pour le titre, le verdict et les résultats propres au jeu | Bilan de manche et suite | Retour personnel |
| Pause | Salle principale pour les jeux classiques. Décor alpin pour le Tyrolien | Reprise de la manche | Indication de pause |
| Fin du jeu | Résultats dans le décor du jeu | Choix du jeu suivant, podium général | Résultats personnels |
| Podium général | Salle principale | Clôture de la soirée | Classement de la soirée |

La règle de décor est commune à la TV et à l’aperçu régie. Le salon vide et la cérémonie générale restent dans la salle principale. La révélation utilise le contenu de la manche et un effet lumineux, sans panneau flottant par-dessus le titre.

## Vérification des dix jeux

| Jeu | Mécanique et affichage repérés | Écart ou point à tester |
| --- | --- | --- |
| Blind Test | Titre, artiste ou les deux. Réponses au téléphone ou arbitrage au buzzer. | Vérifier le passage entre réponse partielle, réponse complète et verdict sur les trois écrans. L’arbitrage oral exige un animateur. |
| Frise musicale | Ancre datée, placement entre deux titres. Frise collective commune ou frise individuelle. | Corrigé dans ce lot. Le décor Chronoscope s’ouvre à la présentation. La régie révèle après toutes les réponses, et le téléphone précise le résultat du placement. La frise collective est visible aussi à la révélation sur TV. |
| Bingo musical | Grille de 16 titres, choix pendant l’extrait, coche à la révélation. Victoires officielles et arrêt après la première ligne. | Tester deux joueurs terminant une ligne au même tirage et l’arrêt sur première ligne depuis la régie. Les cases et lignes ont leur propre suivi, distinct des statistiques de quiz. |
| La bonne pochette | Choix parmi quatre pochettes. La solution est publiée à la révélation. | Vérifier le chargement des quatre images sur téléphone et TV. Le contrôle de la playlist et le chargement d’images dépendent des sources disponibles. |
| Une seconde pour trouver | Écoutes successives de 1, 2, 5 et 10 s avec barème progressif. | Vérifier les pauses et les reprises à chaque palier. Le mode automatique intégral reste indisponible pour cette conduite par paliers. |
| Dernier survivant | Vies, élimination et poursuite du classement individuel. | Vérifier la distinction entre gagnant de la partie et premier au score, en particulier lorsqu’une partie est interrompue. |
| Maillon faible | Réponses, sécurisation des points et vote d’élimination. | La régie fait avancer le jeu après le vote. Tester l’affichage du vote et le cas sans voix. La conduite automatique intégrale est indisponible. |
| Les reprises | Reconnaissance en QCM à partir de la reprise ou de la version originale selon le réglage. | Vérifier que l’extrait diffusé correspond bien au réglage et que les deux interprètes sont correctement nommés au verdict. |
| Cinéma musical | Questions et réponses orientées films, séries ou génériques selon la catégorie. | Vérifier les libellés selon la catégorie et le comportement de la grille TV avec cinq choix. |
| Le Tyrolien | Blind test par équipe, ascension, bonus, vote d’attaque, chute et classement individuel. | Tester le vote côté équipe bénéficiaire et le parcours mode automatique avec trois équipes. L’écran doit conserver son décor alpin. |

## Écarts transversaux à traiter par ordre de priorité

1. **Parcours réel**. Lancer une soirée locale avec une TV et deux téléphones, puis jouer une manche complète par jeu. Reproduire un chargement audio en erreur et une reconnexion. La suite existante couvre surtout le moteur, les états publics et le serveur local.
2. **Cohérence des commandes**. Contrôler une commande de lancement par phase, un retour au salon cohérent et une séparation claire entre fin de jeu et fin de soirée. La Frise, le Bingo et le Tyrolien ont encore des commandes propres au-dessus du socle commun.
3. **Cohérence des résultats**. Distinguer performance par manche, classement du jeu et classement de la soirée. Valider les ex æquo. La Frise garde ici son départage actuel au temps à score égal, qui mérite une décision si le classement final doit exclure toute mesure de vitesse.
4. **Cohérence graphique**. Relire la taille des titres, des QR et des tableaux sur une TV 16:9 et sur téléphone vertical. Contrôler en priorité les contenus hauts, les choix longs, les tableaux et les animations de révélation.

Une nouvelle vue doit être vérifiée sur le salon, le lancement, une manche active, la révélation, la pause et la fin. À chaque étape, vérifier aussi à qui les réponses sont visibles et si la commande affichée est acceptée par le moteur.

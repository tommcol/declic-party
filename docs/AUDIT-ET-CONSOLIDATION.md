# Déclic Party — Audit et consolidation

## Périmètre et références

Chantier 1 exclusivement. Socle fonctionnel [main à 1d88691](https://github.com/tommcol/declic-party/commit/1d88691edbbc299b883f90b3f7527b5b6dbe80a2). Version jouée à comparer [show-experience à 1bcc1d9](https://github.com/tommcol/declic-party/commit/1bcc1d9513bdbc18289228a9f98a8a902511f516). Au moment de l'audit, show-experience contient main et 38 commits supplémentaires. main cumule les scores bruts et utilise le rang par position dans la liste. show-experience a introduit un barème commun de 100 points par jeu et des rangs ex æquo. Les neuf jeux sélectionnables sur show-experience incluent le Tyrolien. « Une seconde pour trouver » a été retiré du sélecteur par 7aaeb44. L’écoute progressive subsiste dans le moteur.

## Registre du chantier 1

| Priorité | Constat et cause | Solution proposée | Périmètre | Statut |
| --- | --- | --- | --- | --- |
| Haute | Le Tyrolien arrêté sans vainqueur classe les équipes encore en jeu à égalité. Le même barème est donné à chaque membre. La conversion accepte même zéro manche terminée. | Contrôler le statut de la partie et l'éligibilité avant d'attribuer les points. Séparer les résultats de la montagne et la contribution individuelle. | Tyrolien, régie, TV, téléphone, archives | Proposé |
| Haute | Un classement sur le rang seul récompense les scores nuls, y compris à égalité en tête. Le Patron se fonde sur le total maximal positif. | Exiger une contribution positive issue d'une manche validée et des points de soirée acquis selon la règle approuvée. | Tous les jeux et distinctions | Proposé |
| Haute | Un arrêt peut terminer et créditer la manche ouverte dans le moteur commun. Au Tyrolien, l'arrêt écarte le score provisoire. Le statut finished ne différencie pas victoire, arrêt et fin de programme. | Enregistrer le motif de fin et les manches éligibles. Un arrêt prévu par les règles peut valider le jeu. Marquer comme hors classement les arrêts pour incident. | Tous les jeux | Proposé |
| Haute | Le total cumulé et le détail des jeux sont calculés séparément. Un instantané est identifié par l'ID de la première question. Réutiliser cet ID remplace l'instantané antérieur alors que le cumul peut créditer les deux jeux. Au Tyrolien, seules les 20 dernières manches restent détaillées. | Attribuer un identifiant durable à chaque partie et inscrire une seule contribution par partie et par joueur. Conserver les agrégats nécessaires aux distinctions et totaux à travers la compaction. | Régie et archives, téléphone et USB | Proposé |
| Haute | Les seuls réglages de partie peuvent donner des critères différents au podium et au général. La frise affiche score et temps au podium, alors que le général inclut le joker dans le score de comparaison. Le podium Bingo applique l'objectif d'arrêt, alors que la conversion consulte tous les jalons. | Lire les critères officiels via un résultat canonique par jeu. Vérifier les égalités et les arrêts Bingo dans les mêmes scénarios. | Frise, Bingo et interfaces de résultats | Proposé |
| Moyenne | Le groupe d'équipes classique additionne les scores individuels. Une équipe nombreuse peut gagner à moyenne inférieure. Le Tyrolien compare la proportion de bonnes réponses puis le temps moyen des bonnes réponses. | Préserver le résultat de jeu actuel. Soumettre séparément toute normalisation du classement des équipes classiques. | Équipes, régie et TV | Proposé |
| Moyenne | Le classement soirée hérité est renuméroté en USB dans certains écrans. Le téléphone reçoit son propre rang à certaines phases. L'archive sépare téléphone et USB et n'explique pas le détail des attributions. La version show-experience écarte du total les points legacy sans scoringVersion 1 et les conserve en brut. | Réutiliser les mêmes rangs et attributions persistés sur toutes les interfaces. Garder distincts les historiques de barèmes et les deux populations tant que leur rapprochement n'est pas défini. | Régie, TV, téléphone, archive et export | Proposé |
| Moyenne | Sans réponse et déconnexion peuvent finir dans la même catégorie statistique. Le nouveau joueur est admis surtout au salon, mais peut apparaître avec zéro point au général avant sa première partie. | Définir la participation par manche. Garder les acquis en cas de déconnexion et classer à partir de la première contribution éligible. Vérifier la reconnexion par simulation locale dédiée. | Tous les jeux | Proposé |

### Calcul des scores par jeu

| Jeu | Manche et partie | Point à vérifier |
| --- | --- | --- |
| Blind test | Titre et artiste à 50 points chacun par défaut. Réponse générique au barème de la question, généralement 100. Vitesse jusqu'à 50, série jusqu'à 50, chaque bonus au plus une fois par manche. En écoute progressive, base à 100/80/60/40 % et vitesse désactivée. | Réponse partielle avec points, jokers, modes texte, QCM et buzzer. Une erreur rapporte zéro et brise la série si la réponse finale n'est pas complète. |
| Bingo | Identification titre ou artiste et bonus du moteur. Les grilles progressent à la révélation. Le dernier jalon recherché décide des candidats à la victoire, le score départage. | Objectif d'arrêt « première ligne », vainqueurs simultanés, reconnaître une chanson et l'avoir sur sa grille. |
| Frise | Un point par placement correct. Le joker double est enregistré à part. En collectif, la carte est insérée lors de la révélation et les scores de placement restent individuels. | Départage au temps et différence entre score affiché et score de conversion. |
| Reprises | QCM du moteur commun au barème de la question, avec options de bonus et jokers compatibles. | Bonus et aucune bonne réponse. |
| Cinéma musical | Barème commun sur la bonne œuvre, avec options de bonus et jokers compatibles. | Calcul identique côté classement et détail de manche. |
| La bonne pochette | Barème commun sur le bon choix A/B/C/D, avec options de bonus et jokers compatibles. | Réponses nulles et égalités sur le score final. |
| Dernier survivant | Barème commun. Mauvaise réponse ou absence coûte une vie sans protection. En cas d'élimination simultanée de tous les joueurs encore actifs, ils repartent à une vie. Conversion actuelle priorise les joueurs non éliminés. | Vainqueur issu des vies, classement des éliminés, partie sans réponse positive. |
| Maillon faible | Bonne réponse alimente le pot à risque, erreur ou absence vide ce pot. La sécurisation et la fin transfèrent les points acquis. La conversion privilégie les joueurs encore en jeu. | Vainqueur sans performance, vote et égalités, total des transferts, arrêts. |
| Tyrolien | Score individuel du moteur commun dans le parcours actuel, un point par bonne réponse dans l'ancien parcours. Montagne classée par taux de bonnes réponses et vitesse moyenne. Le dernier seul monte. Quatre premières places d'affilée ouvrent une attaque. Le général se fonde uniquement sur le résultat collectif dans show-experience. | Déplacement des Bleus quand les Rouges répondent bien reproduit avec les Bleus seuls derniers. Égalité en dernière position sans montée. Départage aléatoire des cibles à égalité ou sans vote. |

### Reproduction du signalement

Sur show-experience, une simulation Node du moteur Tyrolien avec trois joueurs, deux équipes et une manche révèle des scores individuels exactement égaux à **87, 0, 0**. Les Bleus montent. Lorsque l'animateur arrête avant toute chute, il n'y a aucun vainqueur ni éliminé. La conversion attribue la même valeur interne (-1) aux deux équipes encore en jeu, sans lire leur hauteur. Chacune est classée première et chaque membre reçoit **100 points de soirée**. La distinction Le Patron récompense les trois premiers ex æquo. Arrêter au décompte avec les équipes déjà formées attribue également **100/100/100**, avec zéro manche dans l'historique. Le plafond de 100 par jeu permet un cumul de 1 000 sur dix attributions de ce type. L'origine exacte du total observé dans DXJ7FG4P reste à vérifier sur l'archive locale ou son export. Aucune base locale de cette installation n'a été fournie. Aucun accès aux deux soirées signalées.

### Distinctions

| Distinctions | Critère actuel | Proposition à valider |
| --- | --- | --- |
| Le Patron | Premier total positif, tous les ex æquo | Exiger une contribution éligible et partager la distinction à égalité réelle. |
| L'Éclair et In Extremis | Temps positif ou nul pour une bonne réponse, ex æquo sur la valeur brute | Exiger une mesure cohérente de réponse complète. Le moteur conserve aussi un temps de première partie de réponse. En mode buzzer, contrôler la comparabilité avec le temps téléphone. In Extremis requiert un délai de clôture effectif et une fenêtre proche de la fin. |
| Le Diesel | Progression du taux de réussite entre deux moitiés, deux occasions de chaque côté | Conserver le seuil d'échantillon, comparer les occasions réelles et fixer un écart minimal significatif. |
| En Feu, L'Invincible et Le Roi du Retour | Trois bonnes de suite, cinq manches parfaites sur un jeu terminé, deux bonnes après au moins deux erreurs | Écarter les manches annulées et distinguer les erreurs des incidents techniques. |
| Le Sniper | Au moins cinq occasions et le meilleur taux positif | Conserver le seuil et rendre explicite le nombre d'occasions. |
| L'Encyclopédie et Le Mélomane | Au moins trois titres distincts ou deux genres reconnus | Garder les seuils et n'utiliser que les métadonnées connues. |
| Le Solitaire | Seul à réussir parmi au moins deux lignes de résultat | Exiger des concurrents effectivement en mesure de répondre. |
| La Remontada et Le Chasseur | Gain de places depuis la mi-partie, ou gains cumulés de manche en manche | Exiger une progression liée à une performance, au-delà d'un mouvement dû aux absences ou éliminations. |
| Les Inséparables | Groupe avec au moins deux membres et cinq manches à au moins 50 % | Rattacher l'éligibilité au groupe et couvrir le Tyrolien, dont les affectations ne passent pas par le champ utilisé par cette distinction. |

### Barèmes soumis à validation

Tous plafonnent un jeu à 100 points. Un joueur sans contribution positive et vérifiable reçoit 0. Une réponse partielle reconnue par les règles peut rendre éligible. Ex æquo au rang officiel, mêmes points et rangs de compétition (1, 1, 3). Les simulations ci-dessous sont en individuel sur des parties classables.

| Barème | Scores bruts 87/0/0 | Scores bruts 180/160/120 | Scores bruts 180/180/120 | Avantage et limite |
| --- | --- | --- | --- | --- |
| A. Places fixes, 100/70/50/30 à partir de la 4e | 100/0/0 | 100/70/50 | 100/100/50 | Lisible au micro. Les écarts de performance et les écarts au-delà de la troisième place sont peu visibles. |
| B. Pourcentage du meilleur score brut | 100/0/0 | 100/89/67 | 100/100/67 | Reflète l'écart et neutralise l'échelle brute entre jeux, mais un bonus élevé peut beaucoup peser. Le score brut ne désigne pas toujours le vainqueur du Bingo ou du Survivant. |
| C. 70 % de A et 30 % du taux d'occasions réussies, arrondi au point | 100/0/0 si l'unique joueur éligible réussit son unique occasion | 94/67/47 à 80/60/40 % | 94/94/47 à 80/80/40 % | Valorise la régularité. Nécessite de définir une occasion par jeu et de partager le résultat du rang en cas d'égalité officielle, par exemple via le taux moyen du groupe ex æquo. |

Recommandation proposée **A** avec le classement officiel de chaque jeu. En équipe, la place de l'équipe détermine le barème, puis seuls les joueurs ayant apporté une contribution positive vérifiée reçoivent la valeur. Par exemple, si deux joueurs sur trois de l'équipe gagnante ont contribué, ils reçoivent 100 chacun et le troisième reçoit 0. Le podium de la montagne reste collectif. Une partie interrompue par incident reste visible avec ses scores bruts des manches validées et rapporte 0 au général. Une fin autorisée par les règles, comme un Bingo arrêté sur une première ligne validée, peut compter. Les joueurs arrivés plus tard gardent leurs points à partir des jeux qu'ils disputent. Le cumul récompense aussi l'assiduité.

### Aperçu du détail en régie et en historique

Exemple avec le barème A. Le résultat est identique dans l'archive, l'export, la TV et le smartphone, où on peut afficher seulement les colonnes utiles.

| Joueur | Score brut | Rang officiel | Bonus | Points soirée | Motif | Cumul |
| --- | ---: | ---: | --- | ---: | --- | ---: |
| Camille | 87 | 1 | Rapidité +37 comprise dans les 87 | 100 | Première place, contribution vérifiée | 170 |
| Morgan | 0 | — | — | 0 | Aucune contribution positive sur une manche validée | 70 |

### Tests et limites

- Node.js v24.22.3, suites existantes exécutées localement dans deux copies indépendantes. main 95/95, show-experience 112/112. Les suites ne couvrent pas tous les parcours complets ni les appareils réels.
- Reproduction isolée avec `createGame`, `startMountain`, `applyMountain`, `eveningGamePoints` et `eveningDistinctions`. Résultats indiqués ci-dessus. Aucun test sur Batocera.
- Le contrôle d'un arrêt répété et de l'absence de score brut pendant le décompte est couvert par la suite. Il faut ajouter après validation des scénarios de crédit unique de bout en bout, de reconnexion, d'égalité, de retour au salon et d'archive à la suite d'un arrêt. Un test isolé montre qu'enregistrer deux fois le même instantané n'augmente pas le nombre d'instantanés.
- Modification réalisée à cette étape, ce document de suivi uniquement. Aucun barème ou code applicatif modifié. Aucune installation Batocera à lancer pour cette étape. Pour le prochain lot, prévoir un commit séparé avec version de barème persistée et lecture compatible des anciennes archives, afin qu'un retour au code précédent ne demande aucune réécriture de l'historique.
- Statuts de suivi disponibles : à analyser, proposé, validé, développé, testé et définitivement validé. Les corrections du chantier 1 attendent la validation des règles. Chantiers 2 à 6 et les cinq fonctionnalités supplémentaires : à analyser lors de leurs chantiers respectifs.

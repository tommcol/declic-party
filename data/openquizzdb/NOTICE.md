# Questions adaptées d’OpenQuizzDB

Ces données (JSON, questions, réponses et anecdotes, ainsi que leur représentation dans `public/question-bank.js`) sont sous licence **Creative Commons Attribution – Partage dans les mêmes conditions 4.0 International (CC BY-SA 4.0)**. Le texte intégral figure dans LICENSE.txt. Cette licence concerne les données, indépendamment de la licence du code de Déclic.

- Fournisseur : [OpenQuizzDB](https://www.openquizzdb.org/).
- Auteurs : **Philippe Bresoux** et **Geremia Fortunato** (Star Wars). Chaque question conserve son auteur et son lien source.
- Conditions officielles : https://www.openquizzdb.org/licence/ et https://www.openquizzdb.org/faq.html
- Copie utilisée : [Zeuh/OpenQuizzDB](https://github.com/Zeuh/OpenQuizzDB), commit `a16819964d171e40e6652368fc562f3bd27d0c5b`, récupérée le 1 novembre 2026. Les identifiants de cette copie historique ne correspondent pas nécessairement au catalogue actuel du site officiel. Le lien de chaque fichier pointe vers cette révision précise.
- Licence : https://creativecommons.org/licenses/by-sa/4.0/

## Adaptations réalisées par Déclic

Sélection française de 30 questionnaires, suppression de questions périmées, ambiguës ou mal formées (identifiants listés dans `excludedOriginalIds`), normalisation des espaces et de caractères d’encodage, ajout des thèmes, niveaux, paramètres de jeu et identifiants stables. L’ordre des questions et des propositions est mélangé à chaque partie. Les anecdotes conservées proviennent de la source ; cette sélection historique ne constitue pas une vérification exhaustive de tous les faits.

La sélection contient 705 questions. Le premier lot comptait 302 questions ; 403 questions ont été ajoutées le 1 novembre 2026. Pour la redistribuer ou l’adapter, conserver les auteurs, les liens source, la licence et cette indication des changements, et publier les adaptations des données sous la même licence.

Les JSON dans ce dossier sont les données françaises adaptées et réutilisables. Pour régénérer leur module pour le navigateur : `node scripts/build-question-bank.mjs`. Aucun téléchargement ni compte externe n’est nécessaire pendant une partie.

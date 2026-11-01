# Recherche et provenance des questionnaires de Déclic

Recherche élargie effectuée le **1 novembre 2026** : banques francophones, API de trivia, dépôts publics GitHub et catalogues de données ouvertes. Cette recherche est une sélection de sources pertinentes, pas un inventaire exhaustif du Web.

## Contenus intégrés : 746 questions françaises dans 33 thèmes

| Source | Questions retenues | Thèmes | Licence des données | Adaptations et provenance |
| --- | ---: | ---: | --- | --- |
| [OpenQuizzDB](https://www.openquizzdb.org/) | 705 | 30 | CC BY-SA 4.0 | [Notice](openquizzdb/NOTICE.md) ; copie historique épinglée, sélection et retraits documentés par pack |
| [Qulture Open Data](https://www.qulture-app.com/en/open-data/) | 17 | 1 | CC BY 4.0 | [Notice](qulture/NOTICE.md) ; édition française, références factuelles et dates de revue conservées |
| [LearnClash Open Trivia](https://github.com/Pluxia-GmbH/learnclash-open-trivia) | 24 | 2 | CC BY 4.0 | [Notice](learnclash/NOTICE.md) ; français adapté, distracteurs de QCM ajoutés par Déclic |

Les licences concernent les fichiers de données et leur représentation dans `public/question-bank.js`, indépendamment du code de l’application. Les JSON de chaque dossier permettent la réutilisation. Auteurs, URL source et licence sont conservés pour chaque question. Les explications et crédits ne s’affichent dans la partie qu’après révélation. Les images tierces des sources ne sont pas reprises.

L’ancien catalogue de 302 questions est conservé ; 444 questions et 21 thèmes sont ajoutés. Les nouvelles questions ont fait l’objet d’une sélection des formulations, des réponses et des ambiguïtés repérées. Cela ne constitue pas une vérification indépendante exhaustive de toutes les anecdotes de la copie historique OpenQuizzDB.

## Autres sources explorées

| Source | Intérêt et conditions annoncées | Décision pour cette mise à jour |
| --- | --- | --- |
| [Open Trivia DB](https://opentdb.com/api_config.php) | API sans clé, CC BY-SA 4.0, maximum 50 questions par appel et délai de 5 secondes entre appels | Réserve intéressante en anglais ; non intégrée pour éviter des traductions automatiques non relues et une dépendance à l’API pendant les soirées |
| [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA) | Nombreuses catégories, CC BY-SA 4.0 | Source anglaise à sélectionner et traduire avant intégration |
| [OpenTriviaQA-FR](https://github.com/viorizz/OpenTriviaQA-FR) | Dépôt présenté comme traduction française, CC BY-SA 4.0 | L’échantillon musical téléchargé reste en anglais ; pas d’import en masse sous une étiquette française |
| [Livret du Citoyen](https://livretducitoyen.fr/licence) | Questions et données civiques sous Licence Ouverte Etalab 2.0 ; code, identité et médias exclus | Thème possible à l’avenir, mais contenu spécialisé et sensible aux changements de règles ; pas repris dans cette sélection festive |
| [PIAF](https://piaf.netlify.app/dataset/) | Questions-réponses francophones sous CC BY-SA ; corpus de compréhension de texte | Questions dépendantes d’un passage et sans distracteurs prêts à jouer ; non importées automatiquement |
| [Open Quiz Commons](https://github.com/prahladyeri/open-quiz-commons) | Banque QCM sous CC BY-SA 4.0 annoncée | Repérée comme piste ; pas de données reprises ni de validation complète dans cette mise à jour |
| Sites de quiz commerciaux et quiz publics communautaires | Accès gratuit ou partage public ne prouvent pas un droit de redistribution | Aucun questionnaire repris sans licence de réutilisation identifiée |

## Maintenance

Ajouter ou modifier les données JSON, puis lancer `node scripts/build-question-bank.mjs`, `npm test` et `npm run build`. Le générateur vérifie identifiants, format, quatre choix uniques, présence de la bonne réponse et limites des champs. Les tests vérifient aussi les niveaux, la sélection par thème, les crédits multi-sources et la transmission aux salons. Les compteurs de l’interface sont calculés à partir du catalogue ; ils ne sont pas saisis à la main.

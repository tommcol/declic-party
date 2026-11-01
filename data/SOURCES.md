# Recherche et provenance des questionnaires de Déclic

Recherche élargie effectuée le **1 novembre 2026** : banques francophones, API de trivia, dépôts publics GitHub et catalogues de données ouvertes. Cette recherche est une sélection de sources pertinentes, pas un inventaire exhaustif du Web.

## Contenus intégrés : 5 995 questions françaises dans 213 thèmes

| Source | Questions retenues | Thèmes | Licence des données | Adaptations et provenance |
| --- | ---: | ---: | --- | --- |
| [OpenQuizzDB](https://www.openquizzdb.org/) | 5 954 | 210 | CC BY-SA 4.0 | [Notice](openquizzdb/NOTICE.md) ; copie historique épinglée, sélection et retraits documentés par pack |
| [Qulture Open Data](https://www.qulture-app.com/en/open-data/) | 17 | 1 | CC BY 4.0 | [Notice](qulture/NOTICE.md) ; édition française, références factuelles et dates de revue conservées |
| [LearnClash Open Trivia](https://github.com/Pluxia-GmbH/learnclash-open-trivia) | 24 | 2 | CC BY 4.0 | [Notice](learnclash/NOTICE.md) ; français adapté, distracteurs de QCM ajoutés par Déclic |

Les licences concernent les fichiers de données et leur représentation dans `public/question-bank.js`, indépendamment du code de l’application. Les JSON de chaque dossier permettent la réutilisation. Auteurs, URL source et licence sont conservés pour chaque question. Les explications et crédits ne s’affichent dans la partie qu’après révélation. Les images tierces des sources ne sont pas reprises.

Le premier catalogue de 746 questions reste disponible. Une seconde collecte ajoute 5 249 questions et 180 thèmes, pour un total de 5 995 questions et 213 thèmes. Les nouvelles questions ont fait l’objet d’une sélection des formulations, des réponses et des ambiguïtés repérées. Cela ne constitue pas une vérification indépendante exhaustive de toutes les anecdotes de la copie historique OpenQuizzDB.

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

## Import à grande échelle du 1 novembre 2026

La copie historique épinglée contient 290 fichiers JSON, dont 264 valides couvrant 7 920 questions françaises. Les 26 JSON mal formés ne sont pas réparés automatiquement. Les 30 premiers packs OpenQuizzDB et leurs exclusions manuelles restent inchangés. Parmi les autres packs, 54 sont laissés hors de la sélection (actualité people, contenu adulte, santé ou autres thèmes exclus). Sur les candidats restants, 151 questions sont retirées, dont 41 doublons de formulation. Résultat : 5 249 questions ajoutées dans 180 packs.

Le [rapport d’import](import-report.json) conserve les packs exclus, les questions rejetées et les raisons. Le script `scripts/import-openquizzdb.py` documente les règles utilisées et refuse une autre révision source. Ces règles repèrent des formats invalides et certaines formulations périmées ; **elles ne constituent pas une relecture factuelle exhaustive**. Les nouveaux packs portent `review: source-archive`, visible dans le catalogue et dans la préparation. Un aperçu permet de relire les réponses avant de jouer.

Le catalogue léger (`public/question-bank.js`) contient les compteurs, niveaux et URL, sans les questions. Chaque pack est servi séparément sous `/quiz-packs/<id>.json`. Seuls les thèmes sélectionnés sont chargés, avec contrôle d’intégrité, cache en mémoire et nouvelle tentative possible après un échec réseau.

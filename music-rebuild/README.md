# Reconstruction francophone de Déclic Party

Le registre `francophone.mjs` est une première sélection de travail, classée par artiste. Chaque notice porte un identifiant stable, une année de première sortie, un genre, des affectations de playlists et des liens documentaires. Toutes les notices sont en attente côté audio. Ce registre est distinct du catalogue actif et ne déclenche aucune requête fournisseur.

La sélection s'appuie sur les chroniques de France Info publiées par Éduscol pour le répertoire ancien, les archives françaises de ventes, la documentation éditoriale de Nostalgie et les classements de diffusion SNEP/Yacast. Une présence dans un classement radio est une preuve de diffusion à la période indiquée. Elle ne donne pas à elle seule l'année de sortie d'un titre. L'exhaustivité de la sélection et le croisement des sources titre par titre restent à compléter.

## Bilan reproductible

```sh
node music-rebuild/report.mjs
```

Le script vérifie l'unicité des identifiants et des couples artiste–titre, ainsi que les références de sources. Il compte les affectations prévues, qui ne sont pas des playlists jouables. Les titres rejetés pour notoriété insuffisante n'ont pas été comptabilisés pendant ce premier passage. Les titres introuvables et extraits indisponibles ne sont pas mesurés, faute de contrôle audio autorisé de bout en bout. Aucun doublon n'est présent dans la sélection enregistrée selon la clé contrôlée par le script.

## Bascule en attente

Le catalogue en service provient de `src/library-master.js` et `src/library-seed.js`. Le Durable Object conserve les exclusions SQLite. L'application cherche les extraits Deezer au moment de préparer le jeu et le pilote historique ne teste que les en-têtes HTTP. Un en-tête HTTP positif ne prouve pas la lecture.

Les [conditions de Deezer pour les développeurs](https://developers.deezer.com/termsofuse), sections II et III, soumettent l'accès à approbation et réservent la lecture des enregistrements au lecteur intégré, sauf accord écrit contraire. Elles encadrent aussi la constitution d'une base à partir du contenu de l'API. Les [conditions de l'API de recherche iTunes](https://performance-partners.apple.com/search-api) réservent les extraits à la promotion. Aucun accord spécifique couvrant le blind test ni aucun ensemble d'extraits autorisés n'a été identifié dans le projet. Les contrôles de version et de lecture et la bascule des playlists restent à faire avec une source qui couvre cet usage.

La version du catalogue en service avant la reconstruction est conservée dans le commit `e672ed3f743334acdb5b802501f51e1d6e4a818d`. La sélection proposée n'est pas incluse dans la compilation et ne touche pas au stockage local.

## Batocera

Cette mise à jour récupère les fichiers de reconstruction pour consultation et vérification. Elle ne nécessite pas de relancer le serveur.

```sh
cd /media/NO_LABEL/serveur &&
chroot "$PWD/debian" /usr/bin/env PATH=/opt/node22/bin:/usr/bin:/bin /bin/sh -ec '
  cd /opt/applications/declic-party
  git pull --ff-only origin main
  node music-rebuild/report.mjs
'
```

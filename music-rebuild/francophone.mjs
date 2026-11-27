const history = decade => `https://eduscol.education.gouv.fr/chansonsquifontlhistoire/Annees-${decade}.html`;
const radio = (year, week) => `https://snepmusique.com/pdf/classement_pdf.php?annee=${year}&categorie=yacast&semaine=${week}&type=simple`;

export const sources = {
  sardou: "https://www.nostalgie.fr/artistes/michel-sardou/actus/michel-sardou-ses-plus-grands-tubes-350161",
  cabrel: "https://www.nostalgie.fr/artistes/francis-cabrel/actus/francis-cabrel-ses-plus-grands-succes-355376",
  cabrelMarie: "https://www.nostalgie.fr/artistes/francis-cabrel/actus/quand-francis-cabrel-chante-je-laime-a-mourir-en-espagnol-70250368",
  farmer: "https://www.nostalgie.fr/artistes/mylene-farmer/actus/le-phenomene-80-mylene-farmer-70223326",
  claude: "https://www.nostalgie.fr/artistes/claude-francois/actus/claude-francois-ses-5-plus-grandes-chansons-344413",
  dalida: "https://www.nostalgie.fr/artistes/dalida/actus/dalida-ses-5-plus-grands-tubes-348664",
  dalidaDisco: "https://www.nostalgie.fr/actus/100-vinyle-laissez-moi-danser-monday-tuesday-dalida-340006",
  johnny: "https://www.nostalgie.fr/artistes/johnny-hallyday/actus/johnny-hallyday-quelle-est-sa-chanson-preferee-des-francais-353552",
  johnnyLive: "https://www.nostalgie.fr/artistes/johnny-hallyday/concerts-johnny-hallyday-lorada-tour-bercy-1995-re-decouvrez-son-concert-mythique-au-cinema-70251076",
  celine: "https://www.nostalgie.fr/artistes/celine-dion/actus/celine-dion-ecoutez-son-nouveau-tube-ecrit-par-jean-jacques-goldman-ce-soir-a-minuit-sur-nostalgie-70251051",
  celineCulte: "https://www.nostalgie.fr/artistes/celine-dion/actus/celine-dion-fait-revivre-la-memoire-dabraham-pour-lheritage-goldman-vol-2-70249042",
  piaf: "https://histoiredeschansons.com/edith-piaf-milord/",
  chart75: "https://lescharts.com/chanson/peter-et-sloane/besoin-de-rien-envie-de-toi-137105",
  chart76: "https://lescharts.com/chanson/jeanne-mas/johnny-johnny-8365",
  chart77: "https://lescharts.com/chanson/daniel-balavoine/l-aziza-37996",
  chart78: "https://lescharts.com/chanson/gold/capitaine-abandonne-8366",
  chart79: "https://lescharts.com/chanson/stephanie/ouragan-1411",
  chart80: "https://lescharts.com/chanson/jeanne-mas/en-rouge-et-noir-26525",
  chart81: "https://lescharts.com/chanson/images/les-demons-de-minuit-53872",
  chart82: "https://lescharts.com/chanson/julie-pietri/eve-leve-toi-35393",
  chart83: "https://lescharts.com/chanson/elsa/t-en-va-pas-44365",
  chart84: "https://lescharts.com/chanson/licence-iv/viens-boire-un-p-tit-coup-a-la-maison-266489",
  chart85: "https://lescharts.com/chanson/vanessa-paradis/joe-le-taxi-7948",
  chart86: "https://lescharts.com/chanson/guesch-patti/etienne-1741",
  chart87: "https://lescharts.com/chanson/florent-pagny/n-importe-quoi-13157",
  chart88: "https://lescharts.com/chanson/debut-de-soiree/nuit-de-folie-33399",
  chart89: "https://lescharts.com/chanson/mylene-farmer/pourvu-qu-elles-soient-douces-13964",
  chart90: "https://lescharts.com/chanson/philippe-lafontaine/coeur-de-loup-198329",
  chart91: "https://lescharts.com/chanson/roch-voisine/helene-20525",
  chart92: "https://lescharts.com/chanson/francois-feldman/les-valses-de-vienne-132610",
  chart93: "https://lescharts.com/chanson/zouk-machine/maldon-150295",
  chart94: "https://lescharts.com/chanson/felix-gray-didier-barbelivien/a-toutes-les-filles-213420",
  chart95: "https://lescharts.com/chanson/mylene-farmer/desenchantee-2381",
  chart96: "https://lescharts.com/chanson/les-inconnus/auteuil-neuilly-passy-268609",
  chart97: "https://lescharts.com/chanson/lagaf/la-zoubida-268580",
  chart98: "https://lescharts.com/chanson/pow-wow/le-chat-266479",
  chart99: "https://lescharts.com/chanson/jordy/dur-dur-d-etre-bebe-2574",
  chart100: "https://lescharts.com/chanson/regg-lyss/mets-de-l-huile-268959",
  chart101: "https://lescharts.com/chanson/alain-souchon/foule-sentimentale-206133",
  chart102: "https://lescharts.com/chanson/iam/je-danse-le-mia-71582",
  chart103: "https://lescharts.com/chanson/celine-dion/pour-que-tu-m-aimes-encore-3078",
  chart104: "https://lescharts.com/chanson/celine-dion/je-sais-pas-7915",
  chart105: "https://lescharts.com/chanson/mylene-farmer/xxl-3102",
  chart106: "https://lescharts.com/chanson/ophelie-winter/dieu-m-a-donne-la-foi-90069",
  chart107: "https://lescharts.com/chanson/boris-be/soiree-disco-216972",
  chart108: "https://lescharts.com/chanson/khaled/aicha-3376",
  chart109: "https://lescharts.com/chanson/wes/alane-3511",
  chart110: "https://lescharts.com/chanson/florent-pagny/savoir-aimer-13162",
  chart111: "https://lescharts.com/chanson/larusso/tu-m-oublieras-252013",
  chart112: "https://lescharts.com/chanson/moos/au-nom-de-la-rose-252112",
  chart113: "https://lescharts.com/chanson/david-hallyday/tu-ne-m-as-pas-laisse-le-temps-121636",
  chart114: "https://lescharts.com/chanson/zebda/tomber-la-chemise-106840",
  chart115: "https://lescharts.com/chanson/helene-segara/il-y-a-trop-de-gens-qui-t-aiment-72681",
  chart116: "https://lescharts.com/chanson/yannick/ces-soirees-la-4306",
  chart117: "https://lescharts.com/chanson/daft-punk/one-more-time-4514",
  chart118: "https://lescharts.com/chanson/alizee/l-alize-4549",
  chart119: "https://lescharts.com/chanson/garou/seul-4548",
  chart120: "https://lescharts.com/chanson/garou-celine-dion/sous-le-vent-4928",
  chart121: "https://lescharts.com/chanson/l5/toutes-les-femmes-de-ta-vie-4994",
  chart122: "https://lescharts.com/chanson/rohff/qui-est-l-exemple-5118",
  chart123: "https://lescharts.com/chanson/indochine/j-ai-demande-a-la-lune-5246",
  chart124: "https://lescharts.com/chanson/mc-solaar/inch-allah-5287",
  chart125: "https://lescharts.com/chanson/johnny-hallyday/marie-5374",
  chart126: "https://lescharts.com/chanson/nolwenn-leroy/casse-5545",
  chart127: "https://lescharts.com/chanson/chimene-badi/entre-nous-5462",
  chart128: "https://lescharts.com/chanson/florent-pagny/ma-liberte-de-penser-5549",
  chart129: "https://lescharts.com/chanson/pascal-obispo/fan-5638",
  chart130: "https://lescharts.com/chanson/lorie/sur-un-air-latino-5620",
  chart131: "https://lescharts.com/chanson/tragedie/hey-oh-5839",
  chart132: "https://lescharts.com/chanson/k-maro/femme-like-u-donne-moi-ton-corps-6187",
  chart133: "https://lescharts.com/chanson/garou-michel-sardou/la-riviere-de-notre-enfance-6362",
  chart134: "https://lescharts.com/chanson/amel-bent/ma-philosophie-6414",
  chart135: "https://lescharts.com/chanson/ilona-mitrecey/un-monde-parfait-98187",
  chart136: "https://lescharts.com/chanson/faudel/mon-pays-250313",
  chart137: "https://lescharts.com/chanson/fatal-bazooka/fous-ta-cagoule-256031",
  chart138: "https://lescharts.com/chanson/kamini/marly-gomont-266999",
  chart139: "https://lescharts.com/chanson/yannick-noah/aux-arbres-citoyens-256979",
  chart140: "https://lescharts.com/chanson/christophe-mae/on-s-attache-300946",
  chart141: "https://lescharts.com/chanson/christophe-willem/double-je-306761",
  chart142: "https://lescharts.com/chanson/sheryfa-luna/il-avait-les-mots-396163",
  chart143: "https://lescharts.com/chanson/laurent-wolf/no-stress-420755",
  chart144: "https://lescharts.com/chanson/william-balde/rayon-de-soleil-460844",
  chart145: "https://lescharts.com/chanson/magic-system-khaled/meme-pas-fatigue-570446",
  chart146: "https://lescharts.com/chanson/tom-frager-gwayav/lady-melody-600854",
  chart147: "https://lescharts.com/chanson/coeur-de-pirate-julien-dore/pour-un-infidele-583526",
  chart148: "https://lescharts.com/chanson/jessy-matador/allez-ola-ole-684456",
  chart149: "https://lescharts.com/chanson/colonel-reyel/celui-782097",
  chart150: "https://lescharts.com/chanson/mika/elle-me-dit-861992",
  chart151: "https://lescharts.com/chanson/c2c/down-the-road-973782",
  chart152: "https://lescharts.com/chanson/maitre-gims/j-me-tire-1124794",
  chart153: "https://lescharts.com/chanson/daft-punk-feat-pharrell-williams/get-lucky-1132834",
  chart154: "https://lescharts.com/chanson/stromae/papaoutai-1142159",
  chart155: "https://lescharts.com/chanson/stromae/formidable-1152170",
  chart156: "https://lescharts.com/chanson/stromae/tous-les-memes-1182724",
  chart157: "https://lescharts.com/chanson/black-m/sur-ma-route-1269311",
  chart158: "https://lescharts.com/chanson/m-pokora-feat-timbaland-sebastian/dangerous-420004",
  chart159: "https://lescharts.com/chanson/louane/avenir-1364082",
  chart160: "https://lescharts.com/chanson/marina-kaye/homeless-1391792",
  chart161: "https://lescharts.com/chanson/jain/come-1444073",
  chart162: "https://lescharts.com/chanson/kungs-vs-cookin-on-3-burners/this-girl-1528604",
  chart163: "https://lescharts.com/chanson/dj-snake-feat-justin-bieber/let-me-love-you-1576851",
  chart164: "https://lescharts.com/chanson/celine-dion/encore-un-soir-1553870",
  chart165: "https://lescharts.com/chanson/julien-dore/le-lac-1568497",
  h50: history(1950),
  h60: history(1960),
  h70: history(1970),
  h80: history(1980),
  h90: history(1990),
  h00: history(2000),
  oldies: 'https://www.qobuz.com/fr-fr/playlists/les-legendes-de-la-chanson-francaise/2156664',
  goldman: 'https://www.nostalgie.fr/artistes/jean-jacques-goldman/videos',
  goldman1984: 'https://www.nostalgie.fr/artistes/jean-jacques-goldman/actus/envole-moi-quand-jean-jacques-goldman-sattaque-a-la-fatalite-70249789',
  goldman1981: 'https://www.nostalgie.fr/artistes/jean-jacques-goldman/actus/les-chansons-un-peu-moins-connues-de-jean-jacques-goldman-70220206',
  top: 'https://lescharts.com/numeros-un',
  diam: 'https://proxy.siteo.com.s3.amazonaws.com/www.snepmusique.com/file/bilanyacastsemestre06.pdf',
  stromae: 'https://lescharts.com/chanson/stromae/alors-on-danse-604548',
  radio2019: radio(2019, 4),
  radio2020Apr: radio(2020, 17),
  radio2020Jul: radio(2020, 30),
  radio2020Dec: radio(2020, 52),
  radio2021Sep: radio(2021, 39),
  radio2022Jan: radio(2022, 1),
  singles2018: 'https://snepmusique.com/pdf/tops_pdf.php?annee=2018&categorie=Top+Singles&semaine=45',
  radio2024Jan: radio(2024, 2),
  radio2024Apr: radio(2024, 14),
  radio2024Oct: radio(2024, 42),
  radio2025Jun: radio(2025, 24),
  radio2026Jan: radio(2026, 2),
  radio2026Sep: radio(2026, 36),
  melodrama: 'https://lescharts.com/chanson/disiz-theodora/melodrama-2566882',
};

// Registre éditorial groupé par artiste. Les identifiants restent fixes si un crédit est corrigé.
// [identifiant, titre, première sortie, genre, playlists supplémentaires, sources]
export const artists = [
  ['Disiz & Theodora', [
    ['fr-044', 'melodrama', 2025, 'Pop', ['var', 'duos'], ['radio2026Jan', 'radio2026Sep', 'melodrama']],
  ]],
  ['Jacques Brel', [
    ['fr-001', 'Ne me quitte pas', 1959, 'Chanson française', ['var'], ['h50']],
  ]],
  ['Charles Aznavour', [
    ['fr-002', 'Je m’voyais déjà', 1960, 'Chanson française', ['var'], ['h60']],
    ['fr-003', 'La Bohème', 1965, 'Chanson française', ['var'], ['oldies']],
    ['fr-004', 'Comme ils disent', 1972, 'Chanson française', ['var'], ['h70']],
  ]],
  ['Michel Polnareff', [
    ['fr-005', 'Le Bal des Laze', 1968, 'Chanson française', ['var'], ['h60']],
  ]],
  ['Henri Salvador', [
    ['fr-006', 'Zorro est arrivé', 1964, 'Variété', ['var'], ['h60']],
  ]],
  ['Jean Ferrat', [
    ['fr-007', 'Nuit et Brouillard', 1963, 'Chanson française', ['var'], ['h60']],
  ]],
  ['Antoine', [
    ['fr-008', 'Les Élucubrations', 1966, 'Pop', ['var'], ['h60']],
  ]],
  ['Joe Dassin', [
    ['fr-009', 'L’Été indien', 1975, 'Variété', ['var', 'summer'], ['h70']],
    ['fr-010', 'Et si tu n’existais pas', 1975, 'Variété', ['var'], ['oldies']],
  ]],
  ['Michel Delpech', [
    ['fr-011', 'Pour un flirt', 1971, 'Variété', ['var'], ['h70']],
    ['fr-012', 'Les Divorcés', 1973, 'Variété', ['var'], ['h70']],
    ['fr-013', 'Le Loir-et-Cher', 1977, 'Variété', ['var'], ['h70']],
  ]],
  ['Michel Fugain & Le Big Bazar', [
    ['fr-014', 'Une belle histoire', 1972, 'Variété', ['var'], ['h70']],
  ]],
  ['Stone et Charden', [
    ['fr-015', 'L’Avventura', 1971, 'Variété', ['var', 'duos'], ['h70']],
  ]],
  ['Pierre Perret', [
    ['fr-016', 'Lily', 1977, 'Chanson française', ['var'], ['h70']],
  ]],
  ['Daniel Balavoine', [
    ['fr-017', 'Le Chanteur', 1978, 'Pop', ['var'], ['h70']],
    ["fr-077", "L'Aziza", 1985, "Pop", ["var"], ["chart77"]],
  ]],
  ['Jean-Jacques Goldman', [
    ['fr-018', 'Il suffira d’un signe', 1981, 'Pop', ['var'], ['goldman', 'goldman1981']],
    ['fr-019', 'Quand la musique est bonne', 1982, 'Pop', ['var', 'party'], ['goldman', 'goldman1981']],
    ['fr-020', 'Au bout de mes rêves', 1982, 'Pop', ['var'], ['goldman1981']],
    ['fr-021', 'Envole-moi', 1984, 'Pop', ['var'], ['goldman', 'goldman1984']],
    ["fr-074", "Encore un matin", 1984, "Pop", ["var"], ["goldman"]],
  ]],
  ['Jean-Jacques Goldman & Michael Jones', [
    ['fr-022', 'Je te donne', 1985, 'Pop', ['var', 'duos'], ['goldman', 'top']],
  ]],
  ['Les Rita Mitsouko', [
    ['fr-023', 'Marcia Baïla', 1984, 'Pop-rock', ['rock', 'party'], ['h80']],
  ]],
  ['France Gall', [
    ['fr-024', 'Babacar', 1987, 'Pop', ['var'], ['h80']],
  ]],
  ['Kaoma', [
    ['fr-025', 'Lambada', 1989, 'Dance', ['dance', 'party', 'summer'], ['h80', 'top']],
  ]],
  ['Alain Bashung', [
    ['fr-026', 'Osez Joséphine', 1991, 'Rock', ['rock'], ['h90']],
  ]],
  ['Suprême NTM', [
    ['fr-027', 'La Fièvre', 1995, 'Rap', ['rapfr'], ['h90']],
  ]],
  ['Manau', [
    ['fr-028', 'La Tribu de Dana', 1998, 'Rap', ['rapfr', 'party'], ['h90', 'top']],
  ]],
  ["Diam’s", [
    ['fr-029', 'La Boulette (Génération nan nan)', 2006, 'Rap', ['rapfr'], ['top', 'diam']],
  ]],
  ['Helmut Fritz', [
    ['fr-030', 'Ça m’énerve', 2009, 'Dance', ['dance', 'party', 'summer'], ['h00', 'top']],
  ]],
  ['Stromae', [
    ['fr-031', 'Alors on danse', 2009, 'Dance', ['dance', 'party'], ['stromae', 'top']],
    ["fr-154", "Papaoutai", 2013, "Pop", ["dance", "party"], ["chart154"]],
    ["fr-155", "Formidable", 2013, "Pop", ["var"], ["chart155"]],
    ["fr-156", "Tous les mêmes", 2013, "Pop", ["var"], ["chart156"]],
  ]],
  ['Angèle feat. Roméo Elvis', [
    ['fr-032', 'Tout oublier', 2018, 'Pop', ['var', 'duos'], ['radio2019', 'singles2018']],
  ]],
  ['Clara Luciani', [
    ['fr-033', 'La Grenade', 2018, 'Pop', ['var'], ['radio2019']],
  ]],
  ['Bigflo & Oli', [
    ['fr-034', 'Plus tard', 2018, 'Rap', ['rapfr'], ['radio2019']],
  ]],
  ['Kendji Girac', [
    ['fr-035', 'Tiago', 2018, 'Pop', ['var'], ['radio2019']],
    ["fr-170", "Habibi", 2020, "Pop", ["var"], ["radio2020Jul"]],
  ]],
  ['Pierre Garnier', [
    ['fr-036', 'Ceux qu’on était', 2024, 'Pop', ['var'], ['radio2024Apr']],
  ]],
  ['Santa', [
    ['fr-037', 'Popcorn salé', 2022, 'Pop', ['var'], ['radio2024Jan']],
    ['fr-038', 'Recommence-moi', 2024, 'Pop', ['var'], ['radio2024Oct']],
  ]],
  ['Indochine', [
    ['fr-039', 'Le Chant des cygnes', 2024, 'Pop-rock', ['rock'], ['radio2024Oct']],
    ['fr-040', 'L’Amour fou', 2024, 'Pop-rock', ['rock'], ['radio2025Jun']],
    ["fr-123", "J'ai demandé à la lune", 2002, "Pop-rock", ["rock"], ["chart123"]],
  ]],
  ['Louane', [
    ['fr-041', 'La Pluie', 2024, 'Pop', ['var'], ['radio2024Oct']],
    ['fr-042', 'Maman', 2025, 'Pop', ['var'], ['radio2025Jun']],
    ["fr-159", "Avenir", 2014, "Pop", ["var"], ["chart159"]],
    ["fr-172", "Aimer à mort", 2020, "Pop", ["var"], ["radio2021Sep"]],
  ]],
  ['Slimane', [
    ['fr-043', 'Mon amour', 2023, 'Pop', ['var'], ['radio2024Jan']],
  ]],
  ["Édith Piaf", [
    ["fr-045", "Milord", 1959, "Chanson française", ["var"], ["piaf"]],
  ]],
  ["Dalida", [
    ["fr-046", "Bambino", 1956, "Variété", ["var"], ["h50", "dalida"]],
    ["fr-047", "Gigi l’Amoroso", 1974, "Variété", ["var"], ["dalida"]],
    ["fr-048", "Laissez-moi danser (Monday, Tuesday)", 1979, "Disco", ["disco", "party"], ["dalidaDisco"]],
  ]],
  ["Claude François", [
    ["fr-049", "Comme d’habitude", 1967, "Variété", ["var"], ["claude"]],
    ["fr-050", "Cette année-là", 1976, "Disco", ["disco", "party"], ["claude"]],
    ["fr-051", "Alexandrie Alexandra", 1977, "Disco", ["disco", "party"], ["claude"]],
    ["fr-052", "Magnolias for Ever", 1977, "Disco", ["disco", "party"], ["claude"]],
  ]],
  ["Francis Cabrel", [
    ["fr-053", "Petite Marie", 1977, "Chanson française", ["var"], ["cabrelMarie"]],
    ["fr-054", "Je l’aime à mourir", 1979, "Chanson française", ["var"], ["cabrel", "cabrelMarie"]],
    ["fr-055", "Sarbacane", 1989, "Pop-rock", ["rock", "var"], ["cabrel"]],
    ["fr-056", "C’est écrit", 1989, "Pop-rock", ["var"], ["cabrel"]],
    ["fr-057", "La Corrida", 1994, "Pop-rock", ["rock", "var"], ["cabrel"]],
    ["fr-058", "Octobre", 1994, "Chanson française", ["var"], ["cabrel"]],
    ["fr-059", "Je t’aimais, je t’aime, je t’aimerai", 1994, "Chanson française", ["var"], ["cabrel"]],
  ]],
  ["Michel Sardou", [
    ["fr-060", "Les Bals populaires", 1970, "Variété", ["var", "party"], ["sardou"]],
    ["fr-061", "La Maladie d’amour", 1973, "Variété", ["var"], ["sardou"]],
    ["fr-062", "Les Lacs du Connemara", 1981, "Variété", ["var", "party"], ["sardou"]],
  ]],
  ["Johnny Hallyday", [
    ["fr-063", "Que je t’aime", 1969, "Rock", ["rock"], ["johnny"]],
    ["fr-064", "La Musique que j’aime", 1973, "Rock", ["rock"], ["johnnyLive"]],
    ["fr-065", "Gabrielle", 1976, "Rock", ["rock"], ["johnnyLive"]],
    ["fr-066", "Quelque chose de Tennessee", 1985, "Rock", ["rock"], ["johnnyLive"]],
    ["fr-067", "L’Envie", 1986, "Rock", ["rock"], ["johnnyLive"]],
    ["fr-068", "Allumer le feu", 1998, "Rock", ["rock", "party"], ["johnny"]],
    ["fr-125", "Marie", 2002, "Rock", ["rock"], ["chart125"]],
  ]],
  ["Céline Dion", [
    ["fr-069", "S’il suffisait d’aimer", 1998, "Variété", ["var"], ["celineCulte"]],
    ["fr-103", "Pour que tu m'aimes encore", 1995, "Variété", ["var"], ["chart103"]],
    ["fr-104", "Je sais pas", 1995, "Variété", ["var"], ["chart104"]],
    ["fr-164", "Encore un soir", 2016, "Variété", ["var"], ["chart164"]],
  ]],
  ["Céline Dion & Jean-Jacques Goldman", [
    ["fr-070", "J’irai où tu iras", 1995, "Pop-rock", ["var", "duos", "party"], ["celine"]],
  ]],
  ["Mylène Farmer", [
    ["fr-071", "Libertine", 1986, "Pop", ["var"], ["farmer"]],
    ["fr-072", "Sans contrefaçon", 1987, "Pop", ["var", "party"], ["farmer"]],
    ["fr-089", "Pourvu qu'elles soient douces", 1988, "Pop", ["var"], ["chart89"]],
    ["fr-095", "Désenchantée", 1991, "Pop", ["var", "party"], ["chart95"]],
    ["fr-105", "XXL", 1995, "Pop-rock", ["rock", "var"], ["chart105"]],
  ]],
  ["Jean-Jacques Goldman & Sirima", [
    ["fr-073", "Là-bas", 1987, "Pop", ["var", "duos"], ["goldman"]],
  ]],
  ["Peter et Sloane", [
    ["fr-075", "Besoin de rien, envie de toi", 1984, "Variété", ["var", "duos"], ["chart75"]],
  ]],
  ["Jeanne Mas", [
    ["fr-076", "Johnny, Johnny", 1985, "Pop", ["var"], ["chart76"]],
    ["fr-080", "En rouge et noir", 1986, "Pop", ["var"], ["chart80"]],
  ]],
  ["Gold", [
    ["fr-078", "Capitaine abandonné", 1985, "Pop-rock", ["party", "rock"], ["chart78"]],
  ]],
  ["Stéphanie de Monaco", [
    ["fr-079", "Ouragan", 1986, "Pop", ["var"], ["chart79"]],
  ]],
  ["Images", [
    ["fr-081", "Les démons de minuit", 1986, "Dance", ["dance", "party"], ["chart81"]],
  ]],
  ["Julie Pietri", [
    ["fr-082", "Ève lève-toi", 1986, "Pop", ["var"], ["chart82"]],
  ]],
  ["Elsa", [
    ["fr-083", "T'en va pas", 1986, "Variété", ["var"], ["chart83"]],
  ]],
  ["Licence IV", [
    ["fr-084", "Viens boire un p'tit coup à la maison", 1987, "Festif", ["party"], ["chart84"]],
  ]],
  ["Vanessa Paradis", [
    ["fr-085", "Joe le taxi", 1987, "Pop", ["var"], ["chart85"]],
  ]],
  ["Guesch Patti", [
    ["fr-086", "Etienne", 1987, "Pop", ["var"], ["chart86"]],
  ]],
  ["Florent Pagny", [
    ["fr-087", "N'importe quoi", 1987, "Variété", ["var"], ["chart87"]],
    ["fr-110", "Savoir aimer", 1997, "Variété", ["var"], ["chart110"]],
    ["fr-128", "Ma liberté de penser", 2003, "Pop-rock", ["var"], ["chart128"]],
  ]],
  ["Début de Soirée", [
    ["fr-088", "Nuit de folie", 1988, "Dance", ["dance", "party"], ["chart88"]],
  ]],
  ["Philippe Lafontaine", [
    ["fr-090", "Cœur de loup", 1989, "Pop", ["var", "party"], ["chart90"]],
  ]],
  ["Roch Voisine", [
    ["fr-091", "Hélène", 1989, "Variété", ["var"], ["chart91"]],
  ]],
  ["François Feldman", [
    ["fr-092", "Les valses de Vienne", 1989, "Variété", ["var"], ["chart92"]],
  ]],
  ["Zouk Machine", [
    ["fr-093", "Maldòn", 1989, "Zouk", ["party"], ["chart93"]],
  ]],
  ["Félix Gray & Didier Barbelivien", [
    ["fr-094", "À toutes les filles...", 1990, "Variété", ["var", "duos"], ["chart94"]],
  ]],
  ["Les Inconnus", [
    ["fr-096", "Auteuil Neuilly Passy", 1991, "Rap", ["rapfr", "party"], ["chart96"]],
  ]],
  ["Lagaf'", [
    ["fr-097", "La zoubida", 1991, "Festif", ["party"], ["chart97"]],
  ]],
  ["Pow Wow", [
    ["fr-098", "Le chat", 1992, "Pop", ["var"], ["chart98"]],
  ]],
  ["Jordy", [
    ["fr-099", "Dur dur d'être bébé!", 1992, "Dance", ["party"], ["chart99"]],
  ]],
  ["Regg'Lyss", [
    ["fr-100", "Mets de l'huile", 1993, "Reggae", ["party"], ["chart100"]],
  ]],
  ["Alain Souchon", [
    ["fr-101", "Foule sentimentale", 1993, "Chanson française", ["var"], ["chart101"]],
  ]],
  ["IAM", [
    ["fr-102", "Je danse le mia", 1993, "Rap", ["rapfr", "party"], ["chart102"]],
  ]],
  ["Ophélie Winter", [
    ["fr-106", "Dieu m'a donné la foi", 1995, "R&B", ["var"], ["chart106"]],
  ]],
  ["Boris", [
    ["fr-107", "Soirée disco", 1995, "Dance", ["dance", "party"], ["chart107"]],
  ]],
  ["Khaled", [
    ["fr-108", "Aïcha", 1996, "Raï", ["var"], ["chart108"]],
  ]],
  ["Wes", [
    ["fr-109", "Alane", 1997, "Dance", ["dance", "party", "summer"], ["chart109"]],
  ]],
  ["Larusso", [
    ["fr-111", "Tu m'oublieras", 1998, "Pop", ["var", "party"], ["chart111"]],
  ]],
  ["Moos", [
    ["fr-112", "Au nom de la rose", 1998, "Pop", ["var"], ["chart112"]],
  ]],
  ["David Hallyday", [
    ["fr-113", "Tu ne m'as pas laissé le temps", 1999, "Pop", ["var"], ["chart113"]],
  ]],
  ["Zebda", [
    ["fr-114", "Tomber la chemise", 1998, "Pop-rock", ["rock", "party"], ["chart114"]],
  ]],
  ["Hélène Segara", [
    ["fr-115", "Il y a trop de gens qui t'aiment", 1999, "Variété", ["var"], ["chart115"]],
  ]],
  ["Yannick", [
    ["fr-116", "Ces soirées là", 2000, "Rap", ["rapfr", "party"], ["chart116"]],
  ]],
  ["Daft Punk", [
    ["fr-117", "One More Time", 2000, "Électro", ["dance", "party"], ["chart117"]],
  ]],
  ["Alizée", [
    ["fr-118", "L'Alizé", 2000, "Pop", ["var"], ["chart118"]],
  ]],
  ["Garou", [
    ["fr-119", "Seul", 2000, "Variété", ["var"], ["chart119"]],
  ]],
  ["Garou & Céline Dion", [
    ["fr-120", "Sous le vent", 2000, "Variété", ["var", "duos"], ["chart120"]],
  ]],
  ["L5", [
    ["fr-121", "Toutes les femmes de ta vie", 2001, "Pop", ["var", "party"], ["chart121"]],
  ]],
  ["Rohff", [
    ["fr-122", "Qui est l'exemple?", 2001, "Rap", ["rapfr"], ["chart122"]],
  ]],
  ["MC Solaar", [
    ["fr-124", "Inch'Allah", 2001, "Rap", ["rapfr"], ["chart124"]],
  ]],
  ["Nolwenn Leroy", [
    ["fr-126", "Cassé", 2003, "Pop", ["var"], ["chart126"]],
  ]],
  ["Chimène Badi", [
    ["fr-127", "Entre nous", 2003, "Variété", ["var"], ["chart127"]],
  ]],
  ["Pascal Obispo", [
    ["fr-129", "Fan", 2003, "Pop-rock", ["var"], ["chart129"]],
  ]],
  ["Lorie", [
    ["fr-130", "Sur un air latino", 2003, "Pop", ["var", "summer"], ["chart130"]],
  ]],
  ["Tragédie", [
    ["fr-131", "Hey Oh", 2003, "R&B", ["var", "party"], ["chart131"]],
  ]],
  ["K-Maro", [
    ["fr-132", "Femme Like U (Donne-moi ton corps)", 2004, "R&B", ["var", "party"], ["chart132"]],
  ]],
  ["Garou & Michel Sardou", [
    ["fr-133", "La rivière de notre enfance", 2003, "Variété", ["var", "duos"], ["chart133"]],
  ]],
  ["Amel Bent", [
    ["fr-134", "Ma philosophie", 2004, "R&B", ["var"], ["chart134"]],
  ]],
  ["Ilona Mitrecey", [
    ["fr-135", "Un monde parfait", 2005, "Dance", ["dance", "party"], ["chart135"]],
  ]],
  ["Faudel", [
    ["fr-136", "Mon pays", 2006, "Raï", ["var"], ["chart136"]],
  ]],
  ["Fatal Bazooka", [
    ["fr-137", "Fous ta cagoule", 2006, "Rap", ["rapfr", "party"], ["chart137"]],
  ]],
  ["Kamini", [
    ["fr-138", "Marly-Gomont", 2006, "Rap", ["rapfr"], ["chart138"]],
  ]],
  ["Yannick Noah", [
    ["fr-139", "Aux arbres citoyens", 2006, "Pop", ["var"], ["chart139"]],
  ]],
  ["Christophe Maé", [
    ["fr-140", "On s'attache", 2007, "Pop", ["var"], ["chart140"]],
  ]],
  ["Christophe Willem", [
    ["fr-141", "Double je", 2007, "Pop", ["var", "party"], ["chart141"]],
  ]],
  ["Sheryfa Luna", [
    ["fr-142", "Il avait les mots", 2007, "R&B", ["var"], ["chart142"]],
  ]],
  ["Laurent Wolf", [
    ["fr-143", "No Stress", 2008, "Électro", ["dance", "party"], ["chart143"]],
  ]],
  ["William Baldé", [
    ["fr-144", "Rayon de soleil", 2008, "Pop", ["var", "summer"], ["chart144"]],
  ]],
  ["Magic System & Khaled", [
    ["fr-145", "Même pas fatigué!!!", 2009, "Raï", ["party", "summer"], ["chart145"]],
  ]],
  ["Tom Frager & Gwayav'", [
    ["fr-146", "Lady Melody", 2008, "Reggae", ["var", "summer"], ["chart146"]],
  ]],
  ["Cœur de Pirate & Julien Doré", [
    ["fr-147", "Pour un infidèle", 2009, "Pop", ["var", "duos"], ["chart147"]],
  ]],
  ["Jessy Matador", [
    ["fr-148", "Allez ola olé", 2010, "Dance", ["dance", "party"], ["chart148"]],
  ]],
  ["Colonel Reyel", [
    ["fr-149", "Celui...", 2010, "R&B", ["var"], ["chart149"]],
  ]],
  ["Mika", [
    ["fr-150", "Elle me dit", 2011, "Pop", ["var", "party"], ["chart150"]],
  ]],
  ["C2C", [
    ["fr-151", "Down The Road", 2012, "Électro", ["dance"], ["chart151"]],
  ]],
  ["Maître Gims", [
    ["fr-152", "J'me tire", 2013, "Rap", ["rapfr"], ["chart152"]],
  ]],
  ["Daft Punk feat. Pharrell Williams", [
    ["fr-153", "Get Lucky", 2013, "Disco", ["disco", "dance", "party"], ["chart153"]],
  ]],
  ["Black M", [
    ["fr-157", "Sur ma route", 2014, "Rap", ["rapfr"], ["chart157"]],
  ]],
  ["M. Pokora feat. Timbaland & Sebastian", [
    ["fr-158", "Dangerous", 2014, "Électro", ["dance"], ["chart158"]],
  ]],
  ["Marina Kaye", [
    ["fr-160", "Homeless", 2014, "Pop", ["var"], ["chart160"]],
  ]],
  ["Jain", [
    ["fr-161", "Come", 2015, "Pop", ["var", "party"], ["chart161"]],
  ]],
  ["Kungs vs. Cookin' On 3 Burners", [
    ["fr-162", "This Girl", 2016, "Électro", ["dance", "party"], ["chart162"]],
  ]],
  ["DJ Snake feat. Justin Bieber", [
    ["fr-163", "Let Me Love You", 2016, "Électro", ["dance"], ["chart163"]],
  ]],
  ["Julien Doré", [
    ["fr-165", "Le lac", 2016, "Pop", ["var"], ["chart165"]],
  ]],
  ["Vianney", [
    ["fr-166", "Beau-papa", 2020, "Pop", ["var"], ["radio2020Dec"]],
  ]],
  ["Vitaa & Slimane", [
    ["fr-167", "Avant toi", 2019, "Pop", ["duos", "var"], ["radio2020Apr"]],
    ["fr-168", "Je te le donne", 2018, "Pop", ["duos", "var"], ["radio2019"]],
    ["fr-169", "Pas beaux", 2019, "Pop", ["duos", "var"], ["radio2020Jul"]],
  ]],
  ["Ofenbach & Quarterhead feat. Norma Jean Martine", [
    ["fr-171", "Head Shoulders Knees & Toes", 2020, "Électro", ["dance", "party"], ["radio2020Jul"]],
  ]],
  ["Angèle", [
    ["fr-173", "Bruxelles je t’aime", 2021, "Pop", ["var"], ["radio2022Jan"]],
  ]],
  ["Trois Cafés Gourmands", [
    ["fr-174", "À nos souvenirs", 2017, "Variété", ["party", "var"], ["radio2019"]],
  ]],
  ["Claudio Capéo", [
    ["fr-175", "Ta main", 2018, "Pop", ["var"], ["radio2019"]],
  ]],
  ["Amir", [
    ["fr-176", "Longtemps", 2018, "Pop", ["var"], ["radio2019"]],
    ["fr-177", "On verra bien", 2020, "Pop", ["var"], ["radio2020Dec"]],
  ]],
];

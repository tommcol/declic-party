const history = decade => `https://eduscol.education.gouv.fr/chansonsquifontlhistoire/Annees-${decade}.html`;
const radio = (year, week) => `https://snepmusique.com/pdf/classement_pdf.php?annee=${year}&categorie=yacast&semaine=${week}&type=simple`;

export const sources = {
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
  ]],
  ['Jean-Jacques Goldman', [
    ['fr-018', 'Il suffira d’un signe', 1981, 'Pop', ['var'], ['goldman', 'goldman1981']],
    ['fr-019', 'Quand la musique est bonne', 1982, 'Pop', ['var', 'party'], ['goldman', 'goldman1981']],
    ['fr-020', 'Au bout de mes rêves', 1982, 'Pop', ['var'], ['goldman1981']],
    ['fr-021', 'Envole-moi', 1984, 'Pop', ['var'], ['goldman', 'goldman1984']],
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
  ]],
  ['Louane', [
    ['fr-041', 'La Pluie', 2024, 'Pop', ['var'], ['radio2024Oct']],
    ['fr-042', 'Maman', 2025, 'Pop', ['var'], ['radio2025Jun']],
  ]],
  ['Slimane', [
    ['fr-043', 'Mon amour', 2023, 'Pop', ['var'], ['radio2024Jan']],
  ]],
];

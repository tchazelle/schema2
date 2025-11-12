/**
 * Test de génération de page avec les données fournies
 */

const { generatePageTemplate } = require('./utils/mustacheGenerator.js');

// Données exactes de l'utilisateur (version simplifiée)
const pageData = {
  id: 4,
  slug: "albums",
  name: "Albums de Musique",
  description: "Découvrez notre collection d'albums de musique",
  mustache: null,
  css: ".relation.manyToOne {\\nborder:solid 1px blue;\\npadding:0.3rem;\\n}",
  section: {
    album: {
      id: 5,
      slug: "album",
      name: "Albums",
      description: "Tous nos albums de musique disponibles",
      rows: [
        {
          id: 3,
          _table: "MusicAlbum",
          name: "Random Access Memories",
          description: "Quatrième album studio de Daft Punk",
          byArtist: {
            id: 102,
            _table: "Organization",
            name: "Daft Punk",
            description: "Duo français de musique électronique"
          },
          datePublished: "2013-05-17",
          genre: "Electronic, Disco, Funk",
          recordLabel: {
            id: 202,
            _table: "Organization",
            name: "Virgin Records",
            description: "Label de musique britannique"
          },
          track: []
        }
      ]
    },
    genres: {
      id: 6,
      slug: "genres",
      name: "Genres",
      description: "Statistiques de nos albums par genre musical",
      rows: [
        {
          id: 3,
          _table: "MusicAlbum",
          name: "Random Access Memories",
          description: "Quatrième album studio de Daft Punk",
          byArtist: {
            id: 102,
            _table: "Organization",
            name: "Daft Punk"
          },
          genre: "Electronic, Disco, Funk"
        }
      ]
    }
  }
};

console.log('=== Génération du template de page ===\n');
const template = generatePageTemplate(pageData, pageData.section);
console.log(template);

// Compter les occurrences de chaque section
const albumMatches = (template.match(/{{#album}}/g) || []).length;
const genresMatches = (template.match(/{{#genres}}/g) || []).length;

console.log(`\n=== Analyse ===`);
console.log(`Sections {{#album}}: ${albumMatches}`);
console.log(`Sections {{#genres}}: ${genresMatches}`);

// Vérifier si le contenu est dupliqué
const albumContent = template.match(/{{#album}}([\s\S]*?){{\/album}}/);
const genresContent = template.match(/{{#genres}}([\s\S]*?){{\/genres}}/);

if (albumContent && genresContent) {
  const albumInner = albumContent[1].trim();
  const genresInner = genresContent[1].trim();

  if (albumInner === genresInner) {
    console.log('\n❌ PROBLÈME CONFIRMÉ: Les deux sections ont EXACTEMENT le même contenu !');
  } else {
    console.log('\n✓ Les sections ont des contenus différents');
  }
}

/**
 * Test pour reproduire le problème de duplication des relations n:1
 */

const schema = require('./schema.js');
const { generateDataTemplate } = require('./utils/mustacheGenerator.js');

// Mock data simulant des données venant de l'API
// Cas 1: byArtist comme objet complet dans les données directes
const testData1 = {
  rows: [
    {
      id: 'album-1',
      _table: 'MusicAlbum',
      name: 'Abbey Road',
      description: 'Album légendaire',
      datePublished: '1969-09-26',
      genre: 'Rock',
      // Cas 1: byArtist est un objet complet
      byArtist: {
        _table: 'MusicGroup',
        id: 'group-1',
        name: 'The Beatles',
        description: 'Groupe légendaire'
      },
      // Cas 2: recordLabel est juste un ID (string)
      recordLabel: 'label-1'
    }
  ]
};

// Cas 2: byArtist comme ID + objet dans _relations
const testData2 = {
  rows: [
    {
      id: 'album-1',
      _table: 'MusicAlbum',
      name: 'Abbey Road',
      description: 'Album légendaire',
      byArtist: 'group-1',  // ID simple
      _relations: {
        byArtist: {  // Objet complet
          _table: 'MusicGroup',
          id: 'group-1',
          name: 'The Beatles',
          description: 'Groupe légendaire'
        }
      }
    }
  ]
};

console.log('=== Test 1: byArtist comme objet complet ===\n');
const template1 = generateDataTemplate(testData1, 'MusicAlbum');
console.log(template1);

// Vérifier la duplication
const byArtistMatches1 = (template1.match(/{{#byArtist}}/g) || []).length;
console.log(`\n${byArtistMatches1} occurrence(s) de {{#byArtist}} trouvée(s)`);
if (byArtistMatches1 > 1) {
  console.log('❌ PROBLÈME: byArtist apparaît plusieurs fois !');
} else {
  console.log('✓ OK');
}

console.log('\n\n=== Test 2: byArtist comme ID + _relations ===\n');
const template2 = generateDataTemplate(testData2, 'MusicAlbum');
console.log(template2);

const byArtistMatches2 = (template2.match(/{{#byArtist}}/g) || []).length;
console.log(`\n${byArtistMatches2} occurrence(s) de {{#byArtist}} trouvée(s)`);
if (byArtistMatches2 > 1) {
  console.log('❌ PROBLÈME: byArtist apparaît plusieurs fois !');
} else {
  console.log('✓ OK');
}

/**
 * Test complet pour vérifier qu'il n'y a plus de duplication des relations n:1
 */

const schema = require('./schema.js');
const { generateDataTemplate } = require('./utils/mustacheGenerator.js');

console.log('=== Test exhaustif de la duplication des relations n:1 ===\n');

// Test 1: byArtist comme objet complet (relation déjà chargée)
console.log('Test 1: Relation n:1 comme objet complet');
const test1 = {
  rows: [{
    id: 'album-1',
    _table: 'MusicAlbum',
    name: 'Abbey Road',
    byArtist: {  // Objet complet avec _table
      _table: 'MusicGroup',
      id: 'group-1',
      name: 'The Beatles'
    }
  }]
};
const template1 = generateDataTemplate(test1, 'MusicAlbum');
const count1 = (template1.match(/{{#byArtist}}/g) || []).length;
console.log(`  Occurrences de {{#byArtist}}: ${count1}`);
console.log(`  ${count1 === 1 ? '✓ OK' : '❌ ÉCHEC'}\n`);

// Test 2: byArtist comme ID + dans _relations
console.log('Test 2: Relation n:1 comme ID + _relations');
const test2 = {
  rows: [{
    id: 'album-1',
    _table: 'MusicAlbum',
    name: 'Abbey Road',
    byArtist: 'group-1',  // ID simple
    _relations: {
      byArtist: {
        _table: 'MusicGroup',
        id: 'group-1',
        name: 'The Beatles'
      }
    }
  }]
};
const template2 = generateDataTemplate(test2, 'MusicAlbum');
const count2 = (template2.match(/{{#byArtist}}/g) || []).length;
console.log(`  Occurrences de {{#byArtist}}: ${count2}`);
console.log(`  ${count2 === 1 ? '✓ OK' : '❌ ÉCHEC'}\n`);

// Test 3: Plusieurs relations n:1
console.log('Test 3: Plusieurs relations n:1 (byArtist + recordLabel)');
const test3 = {
  rows: [{
    id: 'album-1',
    _table: 'MusicAlbum',
    name: 'Abbey Road',
    byArtist: {
      _table: 'MusicGroup',
      id: 'group-1',
      name: 'The Beatles'
    },
    recordLabel: {
      _table: 'Organization',
      id: 'label-1',
      name: 'Apple Records'
    }
  }]
};
const template3 = generateDataTemplate(test3, 'MusicAlbum');
const countByArtist = (template3.match(/{{#byArtist}}/g) || []).length;
const countRecordLabel = (template3.match(/{{#recordLabel}}/g) || []).length;
console.log(`  Occurrences de {{#byArtist}}: ${countByArtist}`);
console.log(`  Occurrences de {{#recordLabel}}: ${countRecordLabel}`);
console.log(`  ${countByArtist === 1 && countRecordLabel === 1 ? '✓ OK' : '❌ ÉCHEC'}\n`);

// Test 4: Relation n:1 null (ne devrait pas être affichée deux fois)
console.log('Test 4: Relation n:1 null');
const test4 = {
  rows: [{
    id: 'album-1',
    _table: 'MusicAlbum',
    name: 'Abbey Road',
    byArtist: null
  }]
};
const template4 = generateDataTemplate(test4, 'MusicAlbum');
const count4 = (template4.match(/{{#byArtist}}/g) || []).length;
console.log(`  Occurrences de {{#byArtist}}: ${count4}`);
console.log(`  ${count4 === 1 ? '✓ OK' : '❌ ÉCHEC'}\n`);

// Résumé
const allPassed = count1 === 1 && count2 === 1 && countByArtist === 1 && countRecordLabel === 1 && count4 === 1;
console.log('==================================================');
if (allPassed) {
  console.log('✓ TOUS LES TESTS PASSENT ! Aucune duplication détectée.');
} else {
  console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ. Il reste des duplications.');
}
console.log('==================================================');

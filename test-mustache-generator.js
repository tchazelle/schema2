const { generateDataTemplate } = require('./utils/mustacheGenerator.js');

console.log('=== Test du générateur Mustache (avec nouveau générateur basé sur schéma) ===\n');

// Test 1: Générer un template pour MusicAlbum via generateDataTemplate
console.log('--- Template pour MusicAlbum (via generateDataTemplate) ---');
const musicAlbumSection = {
  sqlTable: 'MusicAlbum',
  rows: []
};
const musicAlbumTemplate = generateDataTemplate(musicAlbumSection, 'MusicAlbum');
console.log(musicAlbumTemplate);
console.log('\n');

// Test 2: Générer un template pour Person
console.log('--- Template pour Person (via generateDataTemplate) ---');
const personSection = {
  sqlTable: 'Person',
  rows: []
};
const personTemplate = generateDataTemplate(personSection, 'Person');
console.log(personTemplate);
console.log('\n');

// Test 3: Tester avec Organization
console.log('--- Template pour Organization (via generateDataTemplate) ---');
const organizationSection = {
  sqlTable: 'Organization',
  rows: []
};
const organizationTemplate = generateDataTemplate(organizationSection, 'Organization');
console.log(organizationTemplate);
console.log('\n');

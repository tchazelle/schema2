const TemplateGenerator = require('./utils/template-generator.js');

// Créer une instance du générateur
const generator = new TemplateGenerator();

console.log('=== Test du générateur de templates ===\n');

// Test 1: Générer un template pour MusicAlbum
console.log('--- Template pour MusicAlbum ---');
const musicAlbumTemplate = generator.generateTemplate('MusicAlbum', 'section');
console.log(musicAlbumTemplate);
console.log('\n');

// Test 2: Générer un template pour Person
console.log('--- Template pour Person ---');
const personTemplate = generator.generateTemplate('Person', 'section');
console.log(personTemplate);
console.log('\n');

// Test 3: Générer un template pour Organization
console.log('--- Template pour Organization ---');
const organizationTemplate = generator.generateTemplate('Organization', 'section');
console.log(organizationTemplate);
console.log('\n');

// Test 4: Afficher les relations trouvées pour MusicAlbum
console.log('--- Relations pour MusicAlbum ---');
console.log('Relations N:1 (Many-to-One):');
const manyToOne = generator.findManyToOneRelations('MusicAlbum');
console.log(JSON.stringify(manyToOne, null, 2));

console.log('\nRelations 1:N (One-to-Many):');
const oneToMany = generator.findOneToManyRelations('MusicAlbum');
console.log(JSON.stringify(oneToMany, null, 2));
console.log('\n');

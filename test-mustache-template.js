/**
 * Script de test pour la génération de templates Mustache
 * Usage: node test-mustache-template.js [tableName]
 */

const PageService = require('./services/pageService');

// Simuler un utilisateur admin pour avoir tous les droits
const adminUser = {
  id: 1,
  roles: '@admin',
  email: 'admin@example.com'
};

// Récupérer le nom de la table depuis les arguments ou utiliser MusicAlbum par défaut
const tableName = process.argv[2] || 'MusicAlbum';

console.log(`\n=== Génération du template Mustache pour la table: ${tableName} ===\n`);

// Générer le template avec les options par défaut
const template = PageService.generateMustacheTemplate(tableName, adminUser);

if (template) {
  console.log(template);
  console.log('\n=== Fin du template ===\n');

  // Générer aussi une version sans wrapper pour les sections
  console.log('\n=== Version sans wrapper (pour utilisation dans une section) ===\n');
  const templateNoWrapper = PageService.generateMustacheTemplate(tableName, adminUser, {
    includeWrapper: false,
    includeSystemFields: false,
    maxDepth: 2
  });
  console.log(templateNoWrapper);
  console.log('\n=== Fin du template sans wrapper ===\n');

} else {
  console.error(`Erreur: La table "${tableName}" n'a pas été trouvée dans le schéma.`);
  console.log('\nTables disponibles:');
  const schema = require('./schema.js');
  Object.keys(schema.tables).forEach(table => console.log(`  - ${table}`));
}

console.log('\n=== Options disponibles ===');
console.log('- includeWrapper: Inclure le wrapper <article> (default: true)');
console.log('- includeSystemFields: Inclure les champs système (ownerId, granted, etc.) (default: false)');
console.log('- maxDepth: Profondeur maximale des relations imbriquées (default: 2)');
console.log('\nExemple d\'utilisation dans le code:');
console.log('  const template = PageService.generateMustacheTemplate("MusicAlbum", user, { maxDepth: 3 });');
console.log('');

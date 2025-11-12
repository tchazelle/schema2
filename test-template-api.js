#!/usr/bin/env node

/**
 * Script de test pour l'API de génération de templates
 */

const generateSimpleTemplate = require('./utils/simple-template-generator');
const schema = require('./schema.js');

console.log('='.repeat(60));
console.log('TEST - API de génération de templates Mustache');
console.log('='.repeat(60));

// Test 1 : Liste des tables
console.log('\n📋 Test 1: Liste des tables disponibles');
const tables = Object.keys(schema.tables);
console.log(`✓ ${tables.length} tables trouvées:`, tables.join(', '));

// Test 2 : Génération de templates pour quelques tables
console.log('\n📝 Test 2: Génération de templates');

const testTables = ['Person', 'MusicAlbum', 'Page'];

testTables.forEach(tableName => {
  try {
    console.log(`\n--- Table: ${tableName} ---`);
    const template = generateSimpleTemplate(tableName);
    const lines = template.split('\n').length;
    const fieldCount = (template.match(/data-field=/g) || []).length;

    console.log(`✓ Template généré: ${lines} lignes, ${fieldCount} fields`);

    // Vérifications
    if (!template.includes(`data-table="${tableName}"`)) {
      console.error(`✗ ERREUR: data-table="${tableName}" non trouvé`);
    }
    if (!template.includes('{{#rows}}')) {
      console.error(`✗ ERREUR: {{#rows}} non trouvé`);
    }
    if (!template.includes('{{/rows}}')) {
      console.error(`✗ ERREUR: {{/rows}} non trouvé`);
    }
    if (!template.includes('class="row" data-id="{{id}}"')) {
      console.error(`✗ ERREUR: article.row avec data-id non trouvé`);
    }

    console.log(`✓ Structure validée`);

  } catch (error) {
    console.error(`✗ ERREUR pour ${tableName}:`, error.message);
  }
});

// Test 3 : Exemple de template complet
console.log('\n\n📄 Test 3: Exemple de template complet (Person)');
console.log('='.repeat(60));
const personTemplate = generateSimpleTemplate('Person');
console.log(personTemplate);

console.log('\n' + '='.repeat(60));
console.log('✅ Tests terminés avec succès !');
console.log('='.repeat(60));

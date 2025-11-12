#!/usr/bin/env node

/**
 * Script CLI pour générer automatiquement des templates Mustache
 * à partir du schéma de la base de données
 *
 * Usage:
 *   node generate-template.js <tableName> [context]
 *
 * Exemples:
 *   node generate-template.js MusicAlbum
 *   node generate-template.js Person section
 *   node generate-template.js Page page
 */

const TemplateGenerator = require('./utils/template-generator.js');
const fs = require('fs');
const path = require('path');

// Récupérer les arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Erreur: Vous devez spécifier le nom de la table');
  console.log('\nUsage:');
  console.log('  node generate-template.js <tableName> [context]');
  console.log('\nExemples:');
  console.log('  node generate-template.js MusicAlbum');
  console.log('  node generate-template.js Person section');
  console.log('  node generate-template.js Page page');
  console.log('\nContext: "section" (défaut) ou "page"');
  process.exit(1);
}

const tableName = args[0];
const context = args[1] || 'section';

// Créer une instance du générateur
const generator = new TemplateGenerator();

try {
  console.log(`\n📝 Génération du template pour la table: ${tableName}`);
  console.log(`   Context: ${context}\n`);

  // Générer le template
  const template = generator.generateTemplate(tableName, context);

  // Afficher le template
  console.log('=== Template généré ===\n');
  console.log(template);

  // Proposer de sauvegarder le template
  const outputDir = path.join(__dirname, 'templates');
  const outputFile = path.join(outputDir, `${tableName}.mustache`);

  // Créer le dossier templates s'il n'existe pas
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Sauvegarder le template
  fs.writeFileSync(outputFile, template);
  console.log(`\n✅ Template sauvegardé dans: ${outputFile}`);

  // Afficher les relations trouvées
  console.log('\n=== Relations détectées ===\n');

  const manyToOne = generator.findManyToOneRelations(tableName);
  if (manyToOne.length > 0) {
    console.log('Relations N:1 (Many-to-One):');
    manyToOne.forEach(rel => {
      console.log(`  - ${rel.fieldName} → ${rel.targetTable}`);
    });
  } else {
    console.log('Relations N:1 (Many-to-One): aucune');
  }

  console.log('');

  const oneToMany = generator.findOneToManyRelations(tableName);
  if (oneToMany.length > 0) {
    console.log('Relations 1:N (One-to-Many):');
    oneToMany.forEach(rel => {
      console.log(`  - ${rel.arrayName} (via ${rel.tableName}.${rel.fieldName})`);
    });
  } else {
    console.log('Relations 1:N (One-to-Many): aucune');
  }

  console.log('');

} catch (error) {
  console.error(`\n❌ Erreur: ${error.message}`);
  process.exit(1);
}

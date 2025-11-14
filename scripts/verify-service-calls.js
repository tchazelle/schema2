#!/usr/bin/env node

/**
 * Script to verify all service method calls are valid
 * Run with: node scripts/verify-service-calls.js
 */

const fs = require('fs');
const path = require('path');

// Define all valid methods for each service
const VALID_METHODS = {
  SchemaService: [
    'getTableName',
    'tableExists',
    'getTableConfig',
    'getTableRelations',
    'buildFilteredSchema',
    'getAllTableNames',
    'getDisplayFields',
    'fieldExists',
    'getFieldConfig',
    'getTableStructure'
  ],
  PermissionService: [
    'getInheritedRoles',
    'parseUserRoles',
    'getUserAllRoles',
    'hasPermission',
    'getAllPermissions',
    'getAccessibleTables'
  ],
  EntityService: [
    'canAccessEntity',
    'filterEntityFields',
    'buildWhereClause',
    'compactRelation',
    'canPerformAction',
    'filterAccessibleEntities'
  ],
  AuthService: [
    'generateToken',
    'verifyToken',
    'authMiddleware',
    'requireAuth',
    'setAuthCookie',
    'clearAuthCookie',
    'userEnrich',
    'userEnrichMiddleware'
  ],
  TableDataService: [
    'getTableData',
    'loadRelationsForRow'
  ],
  CrudService: [
    'getListData',
    'getRecordDetails',
    'getVisibleFields',
    'getSearchableFields',
    'removeAccents',
    'formatFieldValue',
    'getMenuTables'
  ],
  PageService: [
    'pagesLoad',
    'buildSectionsAsTableData',
    'pageRender'
  ],
  RepositoryService: [
    'findById',
    'findByIds',
    'findAll',
    'findOne',
    'count',
    'create',
    'update',
    'updateWhere',
    'delete',
    'deleteWhere',
    'findByForeignKey',
    'raw',
    'exists',
    'transaction'
  ],
  TemplateService: [
    'htmlSitePage',
    'htmlCrudPage',
    'htmlSection',
    'htmlDebugJSON',
    'htmlLogin',
    'htmlRow'  // Internal method used by htmlDebugJSON
  ]
};

// Common mistakes mapping
const COMMON_MISTAKES = {
  'SchemaService.getTableSchema': 'SchemaService.getTableConfig',
  'SchemaService.getFieldDefinition': 'SchemaService.getFieldConfig',
  'PermissionService.checkPermission': 'PermissionService.hasPermission',
  'EntityService.canAccessRow': 'EntityService.canAccessEntity',
  'EntityService.canAccessPage': 'EntityService.canAccessEntity',
  'TableDataService.getData': 'TableDataService.getTableData'
};

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const errors = [];
  let inBlockComment = false;

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Skip block comments
    if (trimmedLine.startsWith('/*')) {
      inBlockComment = true;
    }
    if (trimmedLine.endsWith('*/')) {
      inBlockComment = false;
      return;
    }
    if (inBlockComment) {
      return;
    }

    // Skip single-line comments
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
      return;
    }

    // Find all service method calls
    const serviceRegex = /(\w+Service)\.(\w+)\(/g;
    let match;

    while ((match = serviceRegex.exec(line)) !== null) {
      const serviceName = match[1];
      const methodName = match[2];
      const fullCall = `${serviceName}.${methodName}`;

      // Check if service exists
      if (!VALID_METHODS[serviceName]) {
        continue; // Unknown service, skip
      }

      // Check if method is valid
      if (!VALID_METHODS[serviceName].includes(methodName)) {
        const suggestion = COMMON_MISTAKES[fullCall] || null;
        errors.push({
          file: filePath,
          line: index + 1,
          code: line.trim(),
          error: `Invalid method call: ${fullCall}`,
          suggestion: suggestion ? `Did you mean: ${suggestion}?` : null
        });
      }
    }
  });

  return errors;
}

function scanDirectory(dir, extensions = ['.js']) {
  const allErrors = [];

  function walk(directory) {
    const files = fs.readdirSync(directory);

    files.forEach(file => {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules and .git
        if (file !== 'node_modules' && file !== '.git') {
          walk(filePath);
        }
      } else {
        const ext = path.extname(file);
        if (extensions.includes(ext)) {
          const errors = scanFile(filePath);
          allErrors.push(...errors);
        }
      }
    });
  }

  walk(dir);
  return allErrors;
}

// Main execution
console.log('🔍 Scanning for invalid service method calls...\n');

const projectRoot = path.join(__dirname, '..');
const errors = scanDirectory(projectRoot);

if (errors.length === 0) {
  console.log('✅ All service method calls are valid!\n');
  process.exit(0);
} else {
  console.log(`❌ Found ${errors.length} invalid method call(s):\n`);

  errors.forEach((error, index) => {
    console.log(`${index + 1}. ${error.file}:${error.line}`);
    console.log(`   Error: ${error.error}`);
    console.log(`   Code:  ${error.code}`);
    if (error.suggestion) {
      console.log(`   💡 ${error.suggestion}`);
    }
    console.log('');
  });

  console.log('❌ Please fix the errors above before committing.\n');
  process.exit(1);
}

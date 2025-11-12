const schema = require('../schema.js');

/**
 * Générateur de templates Mustache basé sur le schéma
 * Génère des templates HTML avec une structure flexible et configurable
 */
class MustacheTemplateGenerator {
  constructor(schemaObj, options = {}) {
    this.schema = schemaObj;
    this.tables = this.schema.tables || {};
    this.options = {
      useDisplayFields: options.useDisplayFields ?? true,
      rowsVarName: options.rowsVarName || 'rows',
      maxDepth: options.maxDepth ?? 2,
      hiddenId: options.hiddenId ?? true
    };
  }

  generateTemplate(tableName) {
    if (!this.tables[tableName]) throw new Error(`Table "${tableName}" not found in schema`);
    const { rowsVarName } = this.options;
    const title = tableName;
    let tpl = '';
    tpl += `<div class="table" data-table="${title}">\n`;
    tpl += `  <h2>${title}</h2>\n`;
    tpl += `  {{#${rowsVarName}}}\n`;
    tpl += `  <article class="table" data-table="${title}">\n`;
    tpl += `    <div class="row" data-id="{{id}}">\n`;
    tpl += this._renderTableContent(tableName, 1, '      ');
    tpl += `    </div>\n  </article>\n  {{/${rowsVarName}}}\n</div>\n`;
    return tpl;
  }

  _renderTableContent(tableName, depth, indent) {
    if (depth > this.options.maxDepth) return '';
    const table = this.tables[tableName];
    const fields = table.fields || {};
    let out = '';

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      if (this.options.hiddenId && fieldName === 'id') continue;
      if (fieldDef.relation) {
        const relTable = fieldDef.relation;
        out += `${indent}<div class="row" data-relation="${fieldName}" data-type="manyToOne">\n`;
        out += `${indent}  <label class="label">${fieldName}</label>\n`;
        out += `${indent}  {{#${fieldName}}}\n`;
        out += `${indent}  <div class="sub-row manyToOne" data-field-table="${relTable}" data-id="{{id}}">\n`;
        out += this._renderTableFields(relTable, depth + 1, indent + '    ');
        out += `${indent}  </div>\n`;
        out += `${indent}  {{/${fieldName}}}\n`;
        out += `${indent}</div>\n`;
      } else {
        const typeAttr = fieldDef.type || 'varchar';
        out += `${indent}<div class="row" data-field="${fieldName}" data-type="${typeAttr}">\n`;
        out += `${indent}  <label class="label">${fieldName}</label>\n`;
        out += `${indent}  <span class="value">{{${fieldName}}}</span>\n`;
        out += `${indent}</div>\n`;
      }
    }

    if (depth < this.options.maxDepth) {
      out += this._renderOneToManyBlocks(tableName, depth + 1, indent);
    }
    return out;
  }

  _renderTableFields(tableName, depth, indent) {
    const table = this.tables[tableName];
    const fields = table.fields || {};
    let out = '';
    const list = this._getFieldList(tableName);
    for (const f of list) {
      if (this.options.hiddenId && f === 'id') continue;
      const type = fields[f]?.type || 'varchar';
      out += `${indent}<div class="row" data-field="${f}" data-type="${type}">\n`;
      out += `${indent}  <label class="label">${f}</label>\n`;
      out += `${indent}  <span class="value">{{${f}}}</span>\n`;
      out += `${indent}</div>\n`;
    }
    return out;
  }

  _renderOneToManyBlocks(tableName, depth, indent) {
    let out = '';
    for (const [otherName, otherDef] of Object.entries(this.tables)) {
      for (const [fName, fDef] of Object.entries(otherDef.fields || {})) {
        if (fDef.relation === tableName) {
          const arrayName = fDef.arrayName || this._pluralize(otherName);
          out += `${indent}<div class="row" data-relation="${arrayName}" data-type="oneToMany">\n`;
          out += `${indent}  <label class="label">${arrayName}</label>\n`;
          out += `${indent}  {{#${arrayName}}}\n`;
          out += `${indent}  <div class="oneToMany" data-table="${otherName}">\n`;
          out += `${indent}    <article class="table" data-table="${otherName}">\n`;
          out += `${indent}      <div class="row" data-id="{{id}}">\n`;
          out += this._renderTableContent(otherName, depth, indent + '        ');
          out += `${indent}      </div>\n`;
          out += `${indent}    </article>\n`;
          out += `${indent}  </div>\n`;
          out += `${indent}  {{/${arrayName}}}\n`;
          out += `${indent}</div>\n`;
        }
      }
    }
    return out;
  }

  _getFieldList(tableName) {
    const t = this.tables[tableName];
    if (!t) return [];
    const fields = Object.keys(t.fields || {});
    if (!this.options.useDisplayFields) return fields;
    const disp = this._getDisplayFields(tableName);
    return disp.length ? disp : fields;
  }

  _getDisplayFields(tableName) {
    const t = this.tables[tableName];
    if (!t) return [];
    if (Array.isArray(t.displayField)) return t.displayField;
    if (Array.isArray(t.displayFields)) return t.displayFields;
    if (typeof t.displayField === 'string') return [t.displayField];
    if (typeof t.displayFields === 'string') return [t.displayFields];
    return [];
  }

  _pluralize(name) { return name.endsWith('s') ? name : name.toLowerCase() + 's'; }
}

module.exports = MustacheTemplateGenerator;

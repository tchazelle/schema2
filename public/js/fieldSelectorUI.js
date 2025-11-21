/**
 * Field Selector UI Component
 * Composant pour sélectionner des champs dans une table et ses relations (n:1 et 1:n)
 * Compatible smartphone, compact et hiérarchique
 */

class FieldSelectorUI {
  constructor(options = {}) {
    this.table = options.table || null;
    this.onFieldSelect = options.onFieldSelect || (() => {});
    this.showSystemFields = options.showSystemFields || false;
    this.container = options.container || null;
    this.structure = null;
    this.selectedPath = [];

    // System fields to filter
    this.systemFields = ['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'];
  }

  /**
   * Initialise le composant avec la structure de la table
   */
  async init() {
    if (!this.table) {
      throw new Error('Table name is required');
    }

    try {
      // Charger la structure de la table
      const response = await fetch(`/_crud/${this.table}/structure`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load table structure');
      }

      this.structure = data.structure;
      this.render();
    } catch (error) {
      console.error('Error initializing FieldSelectorUI:', error);
      throw error;
    }
  }

  /**
   * Charge la structure d'une table liée
   */
  async loadRelatedTableStructure(tableName) {
    try {
      const response = await fetch(`/_crud/${tableName}/structure`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load related table structure');
      }

      return data.structure;
    } catch (error) {
      console.error('Error loading related table structure:', error);
      return null;
    }
  }

  /**
   * Rendu du composant
   */
  render() {
    if (!this.container) {
      throw new Error('Container element is required');
    }

    const html = `
      <div class="field-selector-ui">
        <div class="field-selector-header">
          <h3 class="field-selector-title">Sélecteur de champs</h3>
          <div class="field-selector-controls">
            <label class="field-selector-toggle">
              <input
                type="checkbox"
                id="show-system-fields"
                ${this.showSystemFields ? 'checked' : ''}
                onchange="fieldSelectorInstance.toggleSystemFields(this.checked)"
              />
              <span>Afficher les champs système</span>
            </label>
          </div>
        </div>

        <div class="field-selector-breadcrumb" id="breadcrumb">
          ${this.renderBreadcrumb()}
        </div>

        <div class="field-selector-content" id="field-list">
          ${this.renderFieldList(this.structure)}
        </div>

        <div class="field-selector-selected" id="selected-field">
          ${this.renderSelectedField()}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachStyles();
  }

  /**
   * Rendu du fil d'Ariane
   */
  renderBreadcrumb() {
    if (this.selectedPath.length === 0) {
      return `<span class="breadcrumb-item active">${this.table}</span>`;
    }

    let breadcrumb = `<a href="#" class="breadcrumb-item" onclick="fieldSelectorInstance.navigateToRoot(); return false;">${this.table}</a>`;

    this.selectedPath.forEach((item, index) => {
      if (index === this.selectedPath.length - 1) {
        breadcrumb += ` <span class="breadcrumb-separator">›</span> <span class="breadcrumb-item active">${item.name}</span>`;
      } else {
        breadcrumb += ` <span class="breadcrumb-separator">›</span> <a href="#" class="breadcrumb-item" onclick="fieldSelectorInstance.navigateTo(${index}); return false;">${item.name}</a>`;
      }
    });

    return breadcrumb;
  }

  /**
   * Rendu de la liste des champs
   */
  renderFieldList(structure, isRelated = false) {
    let html = '<div class="field-list">';

    // Séparer les champs et les relations
    const fieldsAndRelationsN1 = [];
    const relations1N = [];

    // Créer un Set des champs qui ont une relation n:1 pour les exclure de la liste des champs
    const fieldsWithRelations = new Set();
    for (const relationName in structure.relations) {
      const relation = structure.relations[relationName];
      if (relation.type === 'many-to-one' && relation.accessible) {
        fieldsWithRelations.add(relationName);
      }
    }

    // Parcourir les champs
    for (const fieldName in structure.fields) {
      const field = structure.fields[fieldName];

      // Filtrer les champs système si nécessaire
      if (!this.showSystemFields && (this.systemFields.includes(fieldName) || field.common)) {
        continue;
      }

      // Ignorer les champs qui ont une relation (ils seront remplacés par la relation elle-même)
      if (field.relation && fieldsWithRelations.has(fieldName)) {
        continue;
      }

      fieldsAndRelationsN1.push({ name: fieldName, field, type: 'field' });
    }

    // Parcourir les relations
    for (const relationName in structure.relations) {
      const relation = structure.relations[relationName];

      if (!relation.accessible) {
        continue;
      }

      if (relation.type === 'many-to-one') {
        fieldsAndRelationsN1.push({ name: relationName, relation, type: 'relation-n1' });
      } else if (relation.type === 'one-to-many') {
        relations1N.push({ name: relationName, relation, type: 'relation-1n' });
      }
    }

    // Afficher les champs directs et les relations n:1 ensemble (sans titre de section)
    fieldsAndRelationsN1.forEach(({ name, field, relation, type }) => {
      if (type === 'field') {
        const isSelectable = !field.relation;
        html += `
          <div class="field-item ${isSelectable ? 'selectable' : ''}"
               ${isSelectable ? `onclick="fieldSelectorInstance.selectField('${name}')"` : ''}>
            <span class="field-icon">${this.getFieldIcon(field)}</span>
            <span class="field-name">${name}</span>
            <span class="field-type">${field.type}</span>
          </div>
        `;
      } else if (type === 'relation-n1') {
        html += `
          <div class="field-item navigable" onclick="fieldSelectorInstance.navigateToRelation('${name}', 'many-to-one')">
            <span class="field-icon">🔗</span>
            <span class="field-name">${name}</span>
            <span class="field-type">${relation.relatedTable}</span>
            <span class="field-arrow">›</span>
          </div>
        `;
      }
    });

    // Afficher les relations 1:n à la fin (sans titre de section)
    relations1N.forEach(({ name, relation }) => {
      html += `
        <div class="field-item navigable" onclick="fieldSelectorInstance.navigateToRelation('${name}', 'one-to-many')">
          <span class="field-icon">📚</span>
          <span class="field-name">${name}</span>
          <span class="field-type">${relation.relatedTable}</span>
          <span class="field-arrow">›</span>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  /**
   * Rendu du champ sélectionné
   */
  renderSelectedField() {
    if (this.selectedPath.length === 0) {
      return '<div class="no-selection">Aucun champ sélectionné</div>';
    }

    const lastItem = this.selectedPath[this.selectedPath.length - 1];
    const fullPath = this.selectedPath.map(item => item.name).join(' › ');

    return `
      <div class="selected-field-info">
        <div class="selected-label">Champ sélectionné :</div>
        <div class="selected-path">${fullPath}</div>
        ${lastItem.field ? `<div class="selected-type">Type : ${lastItem.field.type}</div>` : ''}
      </div>
    `;
  }

  /**
   * Obtenir l'icône pour un type de champ
   */
  getFieldIcon(field) {
    if (field.isPrimary) return '🔑';
    if (field.relation) return '🔗';

    switch (field.type) {
      case 'integer':
      case 'float':
      case 'decimal':
        return '🔢';
      case 'varchar':
      case 'text':
        return '📝';
      case 'datetime':
      case 'date':
      case 'time':
        return '📅';
      case 'boolean':
        return '✓';
      case 'enum':
        return '📋';
      default:
        return '•';
    }
  }

  /**
   * Navigation vers la racine
   */
  navigateToRoot() {
    this.selectedPath = [];
    this.updateDisplay();
  }

  /**
   * Navigation vers un niveau spécifique
   */
  navigateTo(index) {
    this.selectedPath = this.selectedPath.slice(0, index + 1);
    this.updateDisplay();
  }

  /**
   * Navigation vers une relation
   */
  async navigateToRelation(relationName, relationType) {
    const currentStructure = this.getCurrentStructure();
    const relation = currentStructure.relations[relationName];

    if (!relation || !relation.accessible) {
      alert('Cette relation n\'est pas accessible');
      return;
    }

    // Charger la structure de la table liée
    const relatedStructure = await this.loadRelatedTableStructure(relation.relatedTable);

    if (!relatedStructure) {
      alert('Impossible de charger la structure de la table liée');
      return;
    }

    // Ajouter au chemin
    this.selectedPath.push({
      name: relationName,
      relationType: relationType,
      relation: relation,
      structure: relatedStructure
    });

    this.updateDisplay();
  }

  /**
   * Sélection d'un champ
   */
  selectField(fieldName) {
    const currentStructure = this.getCurrentStructure();
    const field = currentStructure.fields[fieldName];

    if (!field) {
      return;
    }

    // Ajouter au chemin
    this.selectedPath.push({
      name: fieldName,
      field: field
    });

    this.updateDisplay();

    // Appeler le callback
    const fullPath = this.getFullPath();
    this.onFieldSelect(fullPath, field);
  }

  /**
   * Obtenir la structure actuelle (selon le chemin de navigation)
   */
  getCurrentStructure() {
    if (this.selectedPath.length === 0) {
      return this.structure;
    }

    // Trouver le dernier élément qui a une structure (relation)
    for (let i = this.selectedPath.length - 1; i >= 0; i--) {
      if (this.selectedPath[i].structure) {
        return this.selectedPath[i].structure;
      }
    }

    return this.structure;
  }

  /**
   * Obtenir le chemin complet du champ sélectionné
   */
  getFullPath() {
    return this.selectedPath.map(item => item.name).join('.');
  }

  /**
   * Toggle affichage des champs système
   */
  toggleSystemFields(show) {
    this.showSystemFields = show;
    this.updateDisplay();
  }

  /**
   * Mise à jour de l'affichage
   */
  updateDisplay() {
    const breadcrumb = document.getElementById('breadcrumb');
    const fieldList = document.getElementById('field-list');
    const selectedField = document.getElementById('selected-field');

    if (breadcrumb) {
      breadcrumb.innerHTML = this.renderBreadcrumb();
    }

    if (fieldList) {
      const currentStructure = this.getCurrentStructure();
      fieldList.innerHTML = this.renderFieldList(currentStructure);
    }

    if (selectedField) {
      selectedField.innerHTML = this.renderSelectedField();
    }
  }

  /**
   * Attacher les styles CSS
   */
  attachStyles() {
    // Vérifier si les styles existent déjà
    if (document.getElementById('field-selector-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'field-selector-styles';
    style.textContent = `
      .field-selector-ui {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--color-bg-white);
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
      }

      .field-selector-header {
        background: var(--color-bg-section);
        padding: 15px;
        border-bottom: 1px solid var(--color-border);
      }

      .field-selector-title {
        margin: 0 0 10px 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .field-selector-controls {
        display: flex;
        align-items: center;
        gap: 15px;
      }

      .field-selector-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--color-text-secondary);
        cursor: pointer;
        user-select: none;
      }

      .field-selector-toggle input {
        cursor: pointer;
      }

      .field-selector-breadcrumb {
        padding: 12px 15px;
        background: var(--color-bg-white);
        border-bottom: 1px solid var(--color-border);
        font-size: 14px;
        overflow-x: auto;
        white-space: nowrap;
      }

      .breadcrumb-item {
        color: var(--color-primary-text);
        text-decoration: none;
        transition: color 0.2s;
      }

      .breadcrumb-item:hover {
        color: var(--color-primary-hover);
        text-decoration: underline;
      }

      .breadcrumb-item.active {
        color: var(--color-text-secondary);
        font-weight: 500;
      }

      .breadcrumb-separator {
        color: var(--color-text-muted);
        margin: 0 8px;
      }

      .field-selector-content {
        max-height: 400px;
        overflow-y: auto;
      }

      .field-list {
        padding: 10px;
      }

      .field-group {
        margin-bottom: 15px;
      }

      .field-group:last-child {
        margin-bottom: 0;
      }

      .field-group-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 8px 10px;
        background: var(--color-bg-section);
        border-radius: 4px;
        margin-bottom: 5px;
      }

      .field-item {
        display: flex;
        align-items: center;
        padding: 10px;
        gap: 10px;
        border-radius: 4px;
        transition: background 0.2s;
        margin-bottom: 2px;
      }

      .field-item.selectable {
        cursor: pointer;
      }

      .field-item.selectable:hover {
        background: var(--color-bg-hover);
      }

      .field-item.navigable {
        cursor: pointer;
      }

      .field-item.navigable:hover {
        background: var(--color-bg-hover);
      }

      .field-icon {
        font-size: 16px;
        flex-shrink: 0;
      }

      .field-name {
        flex: 1;
        font-weight: 500;
        color: var(--color-text-primary);
        font-size: 14px;
      }

      .field-type {
        font-size: 12px;
        color: var(--color-text-secondary);
        background: var(--color-bg-section);
        padding: 2px 8px;
        border-radius: 3px;
      }

      .field-arrow {
        color: var(--color-text-muted);
        font-size: 18px;
        flex-shrink: 0;
      }

      .field-selector-selected {
        padding: 15px;
        background: var(--color-bg-section);
        border-top: 1px solid var(--color-border);
      }

      .no-selection {
        color: var(--color-text-muted);
        font-size: 14px;
        text-align: center;
      }

      .selected-field-info {
        font-size: 14px;
      }

      .selected-label {
        color: var(--color-text-secondary);
        font-size: 12px;
        margin-bottom: 5px;
      }

      .selected-path {
        color: var(--color-primary-text);
        font-weight: 500;
        margin-bottom: 5px;
      }

      .selected-type {
        color: var(--color-text-secondary);
        font-size: 13px;
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .field-selector-header {
          padding: 12px;
        }

        .field-selector-title {
          font-size: 14px;
        }

        .field-selector-toggle {
          font-size: 13px;
        }

        .field-selector-breadcrumb {
          padding: 10px 12px;
          font-size: 13px;
        }

        .field-selector-content {
          max-height: 300px;
        }

        .field-item {
          padding: 8px;
        }

        .field-name {
          font-size: 13px;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

// Export pour utilisation dans d'autres scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FieldSelectorUI;
}

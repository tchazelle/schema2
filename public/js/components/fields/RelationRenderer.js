/**
 * Relation Renderer Component
 *
 * Renders N:1 relation values as clickable links to the related record.
 * Displays the relation using _label, label, or a formatted string from non-system fields.
 *
 * Dependencies: React
 */


/**
 * N:1 Relation Renderer
 */
class RelationRenderer extends React.Component {
  render() {
    const { relation, fieldName, relatedTable } = this.props;

    if (!relation) {
      return e('span', { className: 'relation-value empty' }, '-');
    }

    const displayValue = this.getDisplayValue(relation);

    return e('div', { className: 'relation-value' },
      e('a', {
        href: `/_crud/${relatedTable}/${relation.id}`,
        className: 'relation-link',
        onClick: (ev) => ev.stopPropagation()
      }, '🔗 ', displayValue)
    );
  }

  getDisplayValue(relation) {
    if (typeof relation === 'string') return relation;

    // Priority 1: Use _label if available (built from displayFields by API)
    if (relation._label) {
      return relation._label;
    }

    // Priority 2: Use label if available (fallback)
    if (relation.label) {
      return relation.label;
    }

    // Priority 3: Collect non-system fields
    const values = [];
    for (const key in relation) {
      if (key !== 'id' && key !== '_table' && !key.startsWith('_') && relation[key]) {
        values.push(relation[key]);
      }
    }

    if (values.length > 0) {
      return values.join(' ');
    }

    return `#${relation.id || '?'}`;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RelationRenderer;
}

// Export to global scope for use in crudList.js
window.RelationRenderer = RelationRenderer;

/**
 * Field Renderer Component
 *
 * Renders field values according to their renderer type.
 * Supports various field types: telephone, email, url, rowLink, filePreview,
 * markdown, date, datetime, boolean, and more.
 *
 * Dependencies: React
 */


/**
 * Field Renderer Component
 * Renders field values according to their renderer type
 */
class FieldRenderer extends React.Component {
  render() {
    const { value, field, tableName, fieldName, row, tableConfig } = this.props;

    if (value === null || value === undefined) {
      return e('span', { className: 'field-value empty' }, '-');
    }

    // Special handling for _dateRange field
    if (fieldName === '_dateRange') {
      // Build precise calendar link from startDate field
      let calendarUrl = '/_calendar';

      // Get startDate field name from tableConfig.calendar or default to 'startDate'
      const startDateField = tableConfig?.calendar?.startDate || 'startDate';
      const startDateValue = row?.[startDateField];

      if (startDateValue) {
        // Parse startDate to extract year and month
        const startDate = new Date(startDateValue);
        if (!isNaN(startDate.getTime())) {
          const year = startDate.getFullYear();
          const month = String(startDate.getMonth() + 1).padStart(2, '0');
          calendarUrl = `/_calendar/${year}/${month}`;
        }
      }

      return e('span', { className: 'field-value daterange' },
        e('a', {
          href: calendarUrl,
          onClick: (ev) => ev.stopPropagation(),
          className: 'field-icon-link',
          title: 'Voir le calendrier'
        }, '📅'),
        ' ',
        value
      );
    }

    const renderer = field.renderer || field.type;

    switch (renderer) {
      case 'telephone':
        return e('span', { className: 'field-value telephone' },
          e('a', {
            href: `tel:${value}`,
            onClick: (ev) => ev.stopPropagation(),
            className: 'field-icon-link',
            title: 'Appeler'
          }, '📞'),
          ' ',
          value
        );

      case 'email':
        return e('span', { className: 'field-value email' },
          e('a', {
            href: `mailto:${value}`,
            onClick: (ev) => ev.stopPropagation(),
            className: 'field-icon-link',
            title: 'Envoyer un email'
          }, '📧'),
          ' ',
          value
        );

      case 'url':
        return e('span', { className: 'field-value url' },
          e('a', {
            href: value,
            target: '_blank',
            rel: 'noopener noreferrer',
            onClick: (ev) => ev.stopPropagation(),
            className: 'field-icon-link',
            title: 'Ouvrir le lien'
          }, '🔗'),
          ' ',
          value
        );

      case 'rowLink':
        // Format: "TableName/id" - render as link to that row
        if (value && value.includes('/')) {
          const [linkTable, linkId] = value.split('/');
          return e('span', { className: 'field-value rowlink' },
            e('a', {
              href: `/_crud/${linkTable}?open=${linkId}`,
              onClick: (ev) => ev.stopPropagation(),
              className: 'field-icon-link',
              title: `Voir ${linkTable}/${linkId}`
            }, '🔗'),
            ' ',
            value
          );
        }
        return e('span', { className: 'field-value text' }, String(value));

      case 'filePreview':
        // Show file path with preview capability
        if (value) {
          return e('span', { className: 'field-value file-preview' },
            e('a', {
              href: `/${value}`,
              target: '_blank',
              rel: 'noopener noreferrer',
              onClick: (ev) => ev.stopPropagation(),
              className: 'field-icon-link',
              title: 'Voir le fichier'
            }, '📎'),
            ' ',
            value
          );
        }
        return e('span', { className: 'field-value text' }, '');

      case 'markdown':
        return e('div', {
          className: 'field-value markdown',
          dangerouslySetInnerHTML: { __html: this.simpleMarkdown(value) }
        });

      case 'date':
      case 'datetime':
        // Parse date as STRING to avoid timezone conversion
        // MySQL returns dates as "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
        let formatted;
        if (renderer === 'datetime') {
          // Parse "2025-11-16 16:00:00" or "2025-11-16T16:00:00"
          const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
          if (match) {
            const [, year, month, day, hours, minutes] = match;
            formatted = `${day}/${month}/${year} ${hours}:${minutes}`;
          } else {
            formatted = String(value);
          }
        } else {
          // Parse "2025-11-16"
          const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            const [, year, month, day] = match;
            formatted = `${day}/${month}/${year}`;
          } else {
            formatted = String(value);
          }
        }

        return e('time', {
          dateTime: value,
          className: 'field-value date'
        }, formatted);

      case 'boolean':
        return e('span', {
          className: `field-value boolean ${value ? 'true' : 'false'}`
        }, value ? '✓' : '✗');

      default:
        return e('span', { className: 'field-value text' }, String(value));
    }
  }

  simpleMarkdown(text) {
    return String(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FieldRenderer;
}

// Export to global scope for use in crudList.js
window.FieldRenderer = FieldRenderer;

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
    const { value, field, tableName, fieldName, row, tableConfig, context } = this.props;

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
        // Show file preview for Attachment records
        // Value is the filePath, row should contain id, fileType, name
        if (value && row) {
          const attachmentId = row.id;
          const fileType = row.fileType || '';
          const fileName = row.name || value;

          // Determine preview type based on file type
          const getPreviewType = (mimeType, filename) => {
            if (mimeType.startsWith('image/')) return 'image';
            if (mimeType.startsWith('audio/')) return 'audio';
            if (mimeType.startsWith('video/')) return 'video';
            if (mimeType === 'application/pdf') return 'pdf';
            if (mimeType.startsWith('text/') || filename.match(/\.(txt|md|markdown)$/i)) return 'text';
            return 'other';
          };

          const previewType = getPreviewType(fileType, fileName);
          const downloadUrl = `/_api/attachments/${attachmentId}/download`;

          // Render preview based on type
          return e('div', {
            className: 'field-value file-preview-container',
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: '#f8f9fa'
            }
          },
            // Preview section
            e('div', {
              className: 'preview-area',
              style: {
                minHeight: '200px',
                maxHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fff',
                borderRadius: '4px',
                overflow: 'hidden'
              }
            },
              previewType === 'image' && e('img', {
                src: `${downloadUrl}?inline=1`,
                alt: fileName,
                style: {
                  maxWidth: '100%',
                  maxHeight: '400px',
                  objectFit: 'contain'
                }
              }),
              previewType === 'audio' && e('div', { style: { width: '100%', padding: '20px' } },
                e('div', { style: { fontSize: '48px', textAlign: 'center', marginBottom: '10px' } }, '🎵'),
                e('audio', {
                  controls: true,
                  style: { width: '100%' }
                },
                  e('source', { src: `${downloadUrl}?inline=1` })
                )
              ),
              previewType === 'video' && e('video', {
                controls: true,
                style: {
                  maxWidth: '100%',
                  maxHeight: '400px',
                  objectFit: 'contain'
                }
              },
                e('source', { src: `${downloadUrl}?inline=1` })
              ),
              previewType === 'pdf' && e('div', { style: { padding: '40px', textAlign: 'center' } },
                e('div', { style: { fontSize: '64px', color: '#dc3545' } }, '📕'),
                e('div', { style: { marginTop: '10px', color: '#666', fontSize: '14px' } }, 'PDF Document'),
                e('a', {
                  href: `${downloadUrl}?inline=1`,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  style: {
                    display: 'inline-block',
                    marginTop: '16px',
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px'
                  }
                }, 'Ouvrir le PDF')
              ),
              previewType === 'text' && e('div', {
                className: 'text-preview-container',
                style: { width: '100%', height: '100%', position: 'relative' }
              },
                e('iframe', {
                  src: `${downloadUrl}?inline=1`,
                  style: {
                    width: '100%',
                    height: '400px',
                    border: 'none',
                    backgroundColor: 'white'
                  }
                })
              ),
              previewType === 'other' && e('div', { style: { padding: '40px', textAlign: 'center' } },
                e('div', { style: { fontSize: '64px' } }, '📄'),
                e('div', { style: { marginTop: '10px', color: '#999', fontSize: '12px' } }, 'Aperçu non disponible')
              )
            ),
            // File info and download link
            e('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                fontSize: '14px'
              }
            },
              e('div', {
                style: {
                  fontWeight: '600',
                  color: '#212529',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                },
                title: fileName
              }, fileName),
              e('a', {
                href: downloadUrl,
                download: fileName,
                onClick: (ev) => ev.stopPropagation(),
                style: {
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }
              }, '⬇️ Télécharger')
            )
          );
        }
        return e('span', { className: 'field-value text' }, '-');

      case 'markdown':
        // In list view, don't interpret markdown - just show plain text to keep row height consistent
        if (context === 'list') {
          return e('span', {
            className: 'field-value markdown-preview',
            title: String(value) // Show full content on hover
          }, String(value));
        }

        // In detail/form view, use marked library for full markdown support (GFM, tables, etc.)
        // Configure marked with GFM support if available
        if (typeof marked !== 'undefined') {
          // Configure marked with GFM support
          marked.setOptions({
            gfm: true,
            breaks: true,
            tables: true
          });
          return e('div', {
            className: 'field-value markdown',
            dangerouslySetInnerHTML: { __html: marked.parse(String(value)) }
          });
        }
        // Fallback to simple markdown if marked is not available
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

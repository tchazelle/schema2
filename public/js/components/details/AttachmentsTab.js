/**
 * AttachmentsTab Component
 *
 * Handles file attachment management including upload, preview, download, and deletion.
 * Supports drag-and-drop file uploads and displays previews for images, audio, video, and PDFs.
 *
 * Features:
 * - Drag-and-drop file upload
 * - Click to select files
 * - Preview for images, audio, video
 * - Download and delete attachments
 * - Grid layout with card-based UI
 *
 * Dependencies:
 * - React (global)
 *
 * @component
 */

const e = React.createElement;

class AttachmentsTab extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      attachments: [],
      loading: true,
      uploading: false,
      dragOver: false
    };
    this.fileInputRef = React.createRef();
  }

  async componentDidMount() {
    await this.loadAttachments();
  }

  loadAttachments = async () => {
    const { tableName, rowId } = this.props;

    try {
      const response = await fetch(`/_api/${tableName}/${rowId}/attachments`);
      const data = await response.json();

      if (data.success) {
        this.setState({
          attachments: data.attachments || [],
          loading: false
        });
      } else {
        console.error('Failed to load attachments:', data.error);
        this.setState({ loading: false });
      }
    } catch (error) {
      console.error('Error loading attachments:', error);
      this.setState({ loading: false });
    }
  }

  handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;

    const { tableName, rowId } = this.props;
    this.setState({ uploading: true });

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`/_api/${tableName}/${rowId}/attachments`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.success) {
          // Reload attachments
          await this.loadAttachments();
          // Notify parent to update count
          if (this.props.onAttachmentChange) {
            this.props.onAttachmentChange();
          }
        } else {
          alert(`Erreur lors de l'upload de ${file.name}: ${data.error}`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert(`Erreur lors de l'upload de ${file.name}`);
      }
    }

    this.setState({ uploading: false });
    if (this.fileInputRef.current) {
      this.fileInputRef.current.value = '';
    }
  }

  handleDelete = async (attachmentId, fileName) => {
    if (!confirm(`Supprimer ${fileName} ?`)) return;

    try {
      const response = await fetch(`/_api/attachments/${attachmentId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Reload attachments
        await this.loadAttachments();
        // Notify parent to update count
        if (this.props.onAttachmentChange) {
          this.props.onAttachmentChange();
        }
      } else {
        alert(`Erreur lors de la suppression: ${data.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Erreur lors de la suppression');
    }
  }

  handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragOver: true });
  }

  handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragOver: false });
  }

  handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragOver: false });

    const files = Array.from(e.dataTransfer.files);
    this.handleFileSelect(files);
  }

  renderPreview(attachment) {
    const { previewType, downloadUrl, fileName, icon } = attachment;

    switch (previewType) {
      case 'image':
        return e('img', {
          src: `${downloadUrl}?inline=1`,
          alt: fileName,
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }
        });

      case 'audio':
        return e('div', { style: { width: '100%', padding: '20px' } },
          e('div', { style: { fontSize: '48px', textAlign: 'center', marginBottom: '10px' } }, icon),
          e('audio', {
            controls: true,
            style: { width: '100%' }
          },
            e('source', { src: `${downloadUrl}?inline=1` })
          )
        );

      case 'video':
        return e('video', {
          controls: true,
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }
        },
          e('source', { src: `${downloadUrl}?inline=1` })
        );

      case 'pdf':
        return e('div', { style: { padding: '40px', textAlign: 'center' } },
          e('div', { style: { fontSize: '64px', color: '#dc3545' } }, '📕'),
          e('div', { style: { marginTop: '10px', color: '#666', fontSize: '14px' } }, 'PDF')
        );

      default:
        return e('div', { style: { padding: '40px', textAlign: 'center' } },
          e('div', { style: { fontSize: '64px' } }, icon),
          e('div', { style: { marginTop: '10px', color: '#999', fontSize: '12px' } }, 'Aperçu non disponible')
        );
    }
  }

  render() {
    const { attachments, loading, uploading, dragOver } = this.state;
    const { permissions } = this.props;
    const canUpload = permissions && permissions.canUpdate;

    if (loading) {
      return e('div', { className: 'attachments-loading', style: { padding: '20px', textAlign: 'center' } },
        'Chargement des pièces jointes...'
      );
    }

    return e('div', { className: 'attachments-tab' },
      // Upload zone
      canUpload && e('div', {
        className: `attachment-upload-zone ${dragOver ? 'drag-over' : ''}`,
        onDragOver: this.handleDragOver,
        onDragLeave: this.handleDragLeave,
        onDrop: this.handleDrop,
        style: {
          border: '2px dashed ' + (dragOver ? '#007bff' : '#ccc'),
          borderRadius: '8px',
          padding: '30px',
          marginBottom: '20px',
          textAlign: 'center',
          backgroundColor: dragOver ? '#f0f8ff' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.3s'
        },
        onClick: () => this.fileInputRef.current && this.fileInputRef.current.click()
      },
        e('div', { style: { fontSize: '48px', marginBottom: '10px' } }, '📎'),
        e('div', { style: { fontSize: '16px', marginBottom: '10px' } },
          dragOver ? 'Déposez le fichier ici' : 'Glissez-déposez un fichier ou cliquez pour sélectionner'
        ),
        e('input', {
          ref: this.fileInputRef,
          type: 'file',
          multiple: true,
          style: { display: 'none' },
          onChange: (e) => this.handleFileSelect(Array.from(e.target.files))
        }),
        uploading && e('div', { style: { marginTop: '10px', color: '#007bff' } }, 'Upload en cours...')
      ),

      // Attachments list
      attachments.length === 0 ? e('div', {
        className: 'no-attachments',
        style: { padding: '20px', textAlign: 'center', color: '#999' }
      }, 'Aucune pièce jointe')
        : e('div', { className: 'attachments-list', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' } },
          attachments.map(att => e('div', {
            key: att.id,
            className: 'attachment-card',
            style: {
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column'
            },
            onClick: () => {
              // Navigate to attachment edit form with parent context
              const { tableName, rowId } = this.props;
              window.location.href = `/_crud/Attachment/${att.id}?parent=${tableName}&parentId=${rowId}`;
            },
            onMouseEnter: (e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            },
            onMouseLeave: (e) => {
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          },
            // Preview section (top)
            e('div', {
              className: 'attachment-preview-section',
              style: {
                minHeight: '150px',
                maxHeight: '200px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #e0e0e0'
              }
            },
              this.renderPreview(att)
            ),
            // Info section (bottom)
            e('div', {
              className: 'attachment-info',
              style: { padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }
            },
              // Filename
              e('div', {
                style: {
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#212529',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                },
                title: att.fileName
              }, att.icon + ' ' + att.fileName),
              // Meta info
              e('div', {
                style: {
                  fontSize: '12px',
                  color: '#6c757d',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center'
                }
              },
                e('span', null, att.fileSizeFormatted),
                e('span', null, '•'),
                e('span', null, new Date(att.createdAt).toLocaleDateString('fr-FR'))
              ),
              // Action buttons
              e('div', {
                style: {
                  display: 'flex',
                  gap: '8px',
                  marginTop: '8px'
                }
              },
                // Download button
                e('a', {
                  href: att.downloadUrl,
                  download: att.fileName,
                  className: 'btn-download-card',
                  style: {
                    flex: 1,
                    padding: '6px 12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    textAlign: 'center',
                    fontWeight: '500'
                  },
                  onClick: (ev) => ev.stopPropagation()
                }, '⬇️ Télécharger'),
                // Delete button
                canUpload && e('button', {
                  onClick: (ev) => {
                    ev.stopPropagation();
                    this.handleDelete(att.id, att.fileName);
                  },
                  className: 'btn-delete-card',
                  style: {
                    padding: '6px 12px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }
                }, '🗑️')
              )
            )
          ))
        )
    );
  }
}

// Export the component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AttachmentsTab;
}

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


class AttachmentsTab extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      attachments: [],
      loading: true,
      uploading: false,
      dragOver: false,
      fullscreenAttachment: null,
      fullscreenIndex: -1,
      editingImageId: null,
      showMenuId: null // ID of attachment with open menu
    };
    this.fileInputRef = React.createRef();
    this.menuRefs = {}; // Store refs for each attachment menu
  }

  async componentDidMount() {
    await this.loadAttachments();
    // Add click listener to close menus when clicking outside
    document.addEventListener('mousedown', this.handleClickOutside);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  handleClickOutside = (event) => {
    const { showMenuId } = this.state;
    if (showMenuId && this.menuRefs[showMenuId]) {
      const menuElement = this.menuRefs[showMenuId];
      if (menuElement && !menuElement.contains(event.target)) {
        this.setState({ showMenuId: null });
      }
    }
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

  handleOpenFullscreen = (attachment, index) => {
    this.setState({
      fullscreenAttachment: attachment,
      fullscreenIndex: index
    });
  }

  handleCloseFullscreen = () => {
    this.setState({
      fullscreenAttachment: null,
      fullscreenIndex: -1
    });
  }

  handlePreviousAttachment = () => {
    const { fullscreenIndex } = this.state;
    const { attachments } = this.state;
    if (fullscreenIndex > 0) {
      const newIndex = fullscreenIndex - 1;
      this.setState({
        fullscreenAttachment: attachments[newIndex],
        fullscreenIndex: newIndex
      });
    }
  }

  handleNextAttachment = () => {
    const { fullscreenIndex } = this.state;
    const { attachments } = this.state;
    if (fullscreenIndex < attachments.length - 1) {
      const newIndex = fullscreenIndex + 1;
      this.setState({
        fullscreenAttachment: attachments[newIndex],
        fullscreenIndex: newIndex
      });
    }
  }

  handleGrantedChange = async (attachmentId, newGranted) => {
    try {
      const response = await fetch(`/_api/Attachment/${attachmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granted: newGranted })
      });

      const data = await response.json();

      if (data.success) {
        // Reload attachments to reflect changes
        await this.loadAttachments();
      } else {
        alert(`Erreur lors de la mise à jour: ${data.error}`);
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Erreur lors de la mise à jour du granted');
    }
  }

  handleOpenImageEditor = (attachmentId) => {
    this.setState({ editingImageId: attachmentId });
  }

  handleCloseImageEditor = () => {
    this.setState({ editingImageId: null });
  }

  handleImageEditorSave = async (result) => {
    // Reload attachments to show the updated/new image
    await this.loadAttachments();

    // Notify parent to update count
    if (this.props.onAttachmentChange) {
      this.props.onAttachmentChange();
    }

    // Close editor
    this.handleCloseImageEditor();

    // Show success message
    alert(result.replaced
      ? '✓ Image mise à jour avec succès'
      : '✓ Nouvelle image créée avec succès'
    );
  }

  /**
   * Generate intelligent markdown link based on file type
   */
  generateMarkdownLink = (attachment) => {
    const { fileName, fileType, downloadUrl } = attachment;

    // Image files: use markdown image syntax
    if (fileType.startsWith('image/')) {
      return `![${fileName}](${downloadUrl})`;
    }

    // Audio files: use HTML audio tag
    if (fileType.startsWith('audio/')) {
      return `<audio controls src="${downloadUrl}">${fileName}</audio>`;
    }

    // Video files: use HTML video tag
    if (fileType.startsWith('video/')) {
      return `<video controls src="${downloadUrl}">${fileName}</video>`;
    }

    // PDF and other documents: use markdown link
    return `[${fileName}](${downloadUrl})`;
  }

  /**
   * Handle adding attachment link to a markdown field
   */
  handleAddToMarkdown = (fieldName, attachment) => {
    const { onAddToMarkdown } = this.props;
    if (!onAddToMarkdown) return;

    const markdownLink = this.generateMarkdownLink(attachment);
    onAddToMarkdown(fieldName, markdownLink);

    // Show feedback
    alert(`✓ Lien ajouté au champ "${fieldName}"`);
  }

  /**
   * Get markdown fields from table structure
   */
  getMarkdownFields = () => {
    const { structure } = this.props;
    if (!structure || !structure.fields) return [];

    return Object.entries(structure.fields)
      .filter(([fieldName, field]) =>
        field && (field.renderer === 'markdown' || field.type === 'markdown')
      )
      .map(([fieldName, field]) => ({
        name: fieldName,
        label: field.label || fieldName
      }));
  }

  /**
   * Get image fields from table structure
   */
  getImageFields = () => {
    const { structure } = this.props;
    if (!structure || !structure.fields) return [];

    return Object.entries(structure.fields)
      .filter(([fieldName, field]) =>
        field && field.renderer === 'image'
      )
      .map(([fieldName, field]) => ({
        name: fieldName,
        label: field.label || fieldName
      }));
  }

  /**
   * Handle using attachment as main image
   */
  handleUseAsMainImage = async (attachmentId, fieldName) => {
    const { tableName, rowId, onImageFieldUpdate } = this.props;

    if (!confirm(`Utiliser cette image comme image principale pour le champ "${fieldName}" ?`)) {
      return;
    }

    this.setState({ showMenuId: null });

    try {
      const response = await fetch(`/_api/attachments/${attachmentId}/copy-to-image-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldName })
      });

      const data = await response.json();

      if (data.success) {
        // Show a subtle toast-style notification instead of alert
        if (window.showToast) {
          window.showToast('✅ Sauvegardé', 'success');
        }

        // Notify parent component if callback provided
        if (onImageFieldUpdate) {
          onImageFieldUpdate(fieldName, data.imageUrl);
        }
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      console.error('Error using as main image:', error);
      alert('Erreur lors de la définition de l\'image principale');
    }
  }

  toggleMenu = (attachmentId) => {
    this.setState(prevState => ({
      showMenuId: prevState.showMenuId === attachmentId ? null : attachmentId
    }));
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
            objectFit: 'contain'
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

      case 'text':
        // Preview for .txt, .md, .markdown files
        return e('div', { style: { padding: '40px', textAlign: 'center' } },
          e('div', { style: { fontSize: '64px' } }, fileName.match(/\.md$|\.markdown$/i) ? '📝' : '📄'),
          e('div', { style: { marginTop: '10px', color: '#666', fontSize: '14px' } },
            fileName.match(/\.md$|\.markdown$/i) ? 'Markdown' : 'Texte'
          )
        );

      default:
        return e('div', { style: { padding: '40px', textAlign: 'center' } },
          e('div', { style: { fontSize: '64px' } }, icon),
          e('div', { style: { marginTop: '10px', color: '#999', fontSize: '12px' } }, 'Aperçu non disponible')
        );
    }
  }

  renderFullscreenViewer() {
    const { fullscreenAttachment, fullscreenIndex, attachments } = this.state;
    if (!fullscreenAttachment) return null;

    const { previewType, downloadUrl, fileName } = fullscreenAttachment;
    const hasPrevious = fullscreenIndex > 0;
    const hasNext = fullscreenIndex < attachments.length - 1;

    return e('div', {
      className: 'attachment-fullscreen-viewer',
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      },
      onClick: this.handleCloseFullscreen
    },
      // Close button
      e('button', {
        style: {
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          color: 'white',
          fontSize: '24px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          cursor: 'pointer',
          zIndex: 10001
        },
        onClick: (e) => {
          e.stopPropagation();
          this.handleCloseFullscreen();
        }
      }, '✕'),

      // Previous button
      hasPrevious && e('button', {
        style: {
          position: 'absolute',
          left: '20px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          color: 'white',
          fontSize: '32px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          cursor: 'pointer',
          zIndex: 10001
        },
        onClick: (e) => {
          e.stopPropagation();
          this.handlePreviousAttachment();
        }
      }, '‹'),

      // Next button
      hasNext && e('button', {
        style: {
          position: 'absolute',
          right: '20px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          color: 'white',
          fontSize: '32px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          cursor: 'pointer',
          zIndex: 10001
        },
        onClick: (e) => {
          e.stopPropagation();
          this.handleNextAttachment();
        }
      }, '›'),

      // Content
      e('div', {
        style: {
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        onClick: (e) => e.stopPropagation()
      },
        previewType === 'image' && e('img', {
          src: `${downloadUrl}?inline=1`,
          alt: fileName,
          style: {
            maxWidth: '100%',
            maxHeight: '90vh',
            objectFit: 'contain'
          }
        }),
        previewType === 'video' && e('video', {
          controls: true,
          autoPlay: true,
          style: {
            maxWidth: '100%',
            maxHeight: '90vh'
          }
        },
          e('source', { src: `${downloadUrl}?inline=1` })
        ),
        previewType === 'pdf' && e('iframe', {
          src: `${downloadUrl}?inline=1`,
          style: {
            width: '90vw',
            height: '90vh',
            border: 'none'
          }
        }),
        previewType === 'text' && e('iframe', {
          src: `${downloadUrl}?inline=1`,
          style: {
            width: '90vw',
            height: '90vh',
            border: 'none',
            backgroundColor: 'white'
          }
        }),
        previewType === 'audio' && e('div', {
          style: {
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '8px'
          }
        },
          e('div', { style: { fontSize: '64px', textAlign: 'center', marginBottom: '20px' } }, '🎵'),
          e('div', { style: { marginBottom: '20px', fontWeight: 'bold' } }, fileName),
          e('audio', {
            controls: true,
            autoPlay: true,
            style: { width: '400px' }
          },
            e('source', { src: `${downloadUrl}?inline=1` })
          )
        )
      ),

      // Filename
      e('div', {
        style: {
          position: 'absolute',
          bottom: '20px',
          color: 'white',
          fontSize: '16px',
          textAlign: 'center',
          maxWidth: '80%'
        }
      }, `${fullscreenIndex + 1} / ${attachments.length} - ${fileName}`)
    );
  }

  render() {
    const { attachments, loading, uploading, dragOver, editingImageId } = this.state;
    const { permissions } = this.props;
    const canUpload = permissions && permissions.canUpdate;

    if (loading) {
      return e('div', { className: 'attachments-loading', style: { padding: '20px', textAlign: 'center' } },
        'Chargement des pièces jointes...'
      );
    }

    return e('div', { className: 'attachments-tab' },
      // Fullscreen viewer
      this.renderFullscreenViewer(),

      // Image Editor Modal
      editingImageId && e(ImageEditorModal, {
        attachmentId: editingImageId,
        attachment: attachments.find(att => att.id === editingImageId),
        onSave: this.handleImageEditorSave,
        onCancel: this.handleCloseImageEditor
      }),

      // Attachments grid (including upload zone as first card)
      e('div', { className: 'attachments-list', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' } },
        // Upload zone card (first card)
        canUpload && e('div', {
          className: `attachment-card upload-card ${dragOver ? 'drag-over' : ''}`,
          onDragOver: this.handleDragOver,
          onDragLeave: this.handleDragLeave,
          onDrop: this.handleDrop,
          style: {
            border: '2px dashed ' + (dragOver ? '#007bff' : '#ccc'),
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: dragOver ? '#f0f8ff' : '#fafafa',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.3s',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '380px'
          },
          onClick: () => this.fileInputRef.current && this.fileInputRef.current.click(),
          onMouseEnter: (e) => {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }
        },
          // Preview section - empty
          e('div', {
            style: {
              minHeight: '150px',
              maxHeight: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #e0e0e0'
            }
          },
            e('div', { style: { fontSize: '64px' } }, '📎')
          ),
          // Info section
          e('div', {
            style: {
              padding: '12px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }
          },
            e('div', { style: { fontSize: '16px', fontWeight: '600', textAlign: 'center' } },
              dragOver ? 'Déposez le fichier ici' : 'Ajouter une pièce jointe'
            ),
            e('div', { style: { fontSize: '12px', color: '#6c757d', textAlign: 'center' } },
              'Glissez-déposez ou cliquez'
            ),
            e('input', {
              ref: this.fileInputRef,
              type: 'file',
              multiple: true,
              style: { display: 'none' },
              onChange: (e) => this.handleFileSelect(Array.from(e.target.files))
            }),
            uploading && e('div', { style: { marginTop: '10px', color: '#007bff', fontSize: '12px' } }, 'Upload en cours...')
          )
        ),

        // Attachment cards
        attachments.map((att, idx) => e('div', {
            key: att.id,
            className: 'card attachment-card',
            style: {
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column'
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
            // Preview section (top) - Click to open fullscreen
            e('div', {
              className: 'attachment-preview-section',
              style: {
                minHeight: '150px',
                maxHeight: '200px',
                overflow: 'visible', // Changed from 'hidden' to allow menu dropdown to show
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #e0e0e0',
                position: 'relative',
                cursor: 'pointer'
              },
              onClick: () => this.handleOpenFullscreen(att, idx)
            },
              // Preview content wrapper with overflow hidden
              e('div', {
                style: {
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              }, this.renderPreview(att)),

              // Three-dot menu button (top right of preview)
              e('button', {
                type: 'button',
                className: 'btn three-dots image-menu',
                style: {
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '32px',
                  height: '32px',
                  
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                },
                onClick: (ev) => {
                  ev.stopPropagation();
                  this.toggleMenu(att.id);
                }
              }, '⋮'),

              // Dropdown menu
              this.state.showMenuId === att.id && e('div', {
                ref: (el) => { this.menuRefs[att.id] = el; },
                className: 'attachment-menu-dropdown',
                style: {
                  position: 'absolute',
                  top: '48px',
                  right: '8px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 100, // Increased from 20 to ensure menu appears above other cards
                  minWidth: '200px'
                }
              },
                e('div', { style: { padding: '4px 0' } },
                  // Edit image (only for images)
                  att.previewType === 'image' && canUpload && e('button', {
                    type: 'button',
                    style: {
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background-color 0.2s'
                    },
                    onMouseEnter: (e) => e.target.style.backgroundColor = '#f5f5f5',
                    onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
                    onClick: (ev) => {
                      ev.stopPropagation();
                      this.setState({ showMenuId: null });
                      this.handleOpenImageEditor(att.id);
                    }
                  }, '✏️ Éditer l\'image'),

                  // Download
                  e('a', {
                    href: att.downloadUrl,
                    download: att.fileName,
                    style: {
                      display: 'block',
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background-color 0.2s'
                    },
                    onMouseEnter: (e) => e.target.style.backgroundColor = '#f5f5f5',
                    onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
                    onClick: (ev) => {
                      ev.stopPropagation();
                      this.setState({ showMenuId: null });
                    }
                  }, '📥 Télécharger'),

                  // Use as main image (only for images with image fields)
                  (() => {
                    const imageFields = this.getImageFields();
                    if (att.previewType !== 'image' || imageFields.length === 0 || !canUpload) {
                      return null;
                    }

                    return imageFields.map(field =>
                      e('button', {
                        key: field.name,
                        type: 'button',
                        style: {
                          width: '100%',
                          padding: '10px 16px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          transition: 'background-color 0.2s'
                        },
                        onMouseEnter: (e) => e.target.style.backgroundColor = '#f5f5f5',
                        onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
                        onClick: (ev) => {
                          ev.stopPropagation();
                          this.handleUseAsMainImage(att.id, field.name);
                        }
                      }, `🖼️ Utiliser comme "${field.label}"`)
                    );
                  })(),

                  // Edit metadata
                  e('a', {
                    href: `/_crud/Attachment/${att.id}?parent=${this.props.tableName}&parentId=${this.props.rowId}`,
                    style: {
                      display: 'block',
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderTop: '1px solid #eee',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background-color 0.2s'
                    },
                    onMouseEnter: (e) => e.target.style.backgroundColor = '#f5f5f5',
                    onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
                    onClick: (ev) => {
                      ev.stopPropagation();
                      this.setState({ showMenuId: null });
                    }
                  }, '⚙️ Modifier les métadonnées'),

                  // Delete
                  canUpload && e('button', {
                    type: 'button',
                    style: {
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderTop: '1px solid #eee',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#dc3545',
                      transition: 'background-color 0.2s'
                    },
                    onMouseEnter: (e) => e.target.style.backgroundColor = '#fee',
                    onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
                    onClick: (ev) => {
                      ev.stopPropagation();
                      this.setState({ showMenuId: null });
                      this.handleDelete(att.id, att.fileName);
                    }
                  }, '🗑️ Supprimer')
                )
              )
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
              // Granted selector
              canUpload && e(GrantedSelector, {
                value: att.granted || 'draft',
                publishableTo: permissions?.publishableTo || [],
                tableGranted: permissions?.tableGranted || {},
                compact: true,
                onChange: (newGranted) => this.handleGrantedChange(att.id, newGranted)
              }),
              // "Add to markdown field" buttons
              (() => {
                const markdownFields = this.getMarkdownFields();
                if (markdownFields.length === 0 || !this.props.onAddToMarkdown) return null;

                return e('div', {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    marginTop: '8px'
                  }
                },
                  markdownFields.map(field =>
                    e('button', {
                      key: field.name,
                      onClick: (ev) => {
                        ev.stopPropagation();
                        this.handleAddToMarkdown(field.name, att);
                      },
                      style: {
                        padding: '4px 8px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '500',
                        textAlign: 'left'
                      },
                      onMouseEnter: (e) => {
                        e.target.style.backgroundColor = '#218838';
                      },
                      onMouseLeave: (e) => {
                        e.target.style.backgroundColor = '#28a745';
                      }
                    }, `➕ Ajouter à "${field.label}"`)
                  )
                );
              })()
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

// Export to global scope for use in crudList.js
window.AttachmentsTab = AttachmentsTab;

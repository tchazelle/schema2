/**
 * NotifyModal Component
 *
 * Modal dialog for sending email notifications about a record.
 * Shows preview of recipients and allows customization of the notification.
 *
 * Dependencies:
 * - React (global)
 * - e (global React.createElement shorthand)
 *
 * @component
 */

class NotifyModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      recipients: [],
      includeSender: false,
      customMessage: '',
      emailPreview: null,
      error: null,
      availableRelations: [],
      selectedRelations: []
    };
  }

  async componentDidMount() {
    await this.loadRecipients();
  }

  async loadRecipients() {
    const { tableName, rowId } = this.props;
    const { includeSender, customMessage, selectedRelations, availableRelations } = this.state;

    this.setState({ loading: true, error: null });

    try {
      const params = new URLSearchParams({
        includeSender: includeSender.toString(),
        customMessage: customMessage
      });

      // Add selected relations as array parameter
      if (selectedRelations.length > 0) {
        params.append('includeRelations', selectedRelations.join(','));
      }

      const response = await fetch(
        `/_api/${tableName}/${rowId}/notify/preview?${params.toString()}`
      );

      const data = await response.json();

      if (data.success) {
        const newState = {
          recipients: data.recipients || [],
          emailPreview: data.emailPreview || null,
          loading: false
        };

        // If this is the first load (availableRelations is empty), set up relations
        if (data.availableRelations && availableRelations.length === 0) {
          newState.availableRelations = data.availableRelations;

          // Pre-select strong relations
          newState.selectedRelations = data.availableRelations
            .filter(rel => rel.isStrong)
            .map(rel => rel.arrayName);
        }

        this.setState(newState);
      } else {
        this.setState({
          error: data.error || 'Erreur lors du chargement des destinataires',
          loading: false
        });
      }
    } catch (error) {
      console.error('Error loading recipients:', error);
      this.setState({
        error: 'Erreur de connexion au serveur',
        loading: false
      });
    }
  }

  handleIncludeSenderChange = async (e) => {
    this.setState({ includeSender: e.target.checked }, () => {
      this.loadRecipients();
    });
  }

  handleMessageChange = (e) => {
    this.setState({ customMessage: e.target.value });

    // Debounce the preview reload (reload after 500ms of no typing)
    clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => {
      this.loadRecipients();
    }, 500);
  }

  handleRelationToggle = (arrayName) => {
    const { selectedRelations } = this.state;
    const newSelected = selectedRelations.includes(arrayName)
      ? selectedRelations.filter(r => r !== arrayName)
      : [...selectedRelations, arrayName];

    this.setState({ selectedRelations: newSelected }, () => {
      // Reload preview with new relations
      this.loadRecipients();
    });
  }

  handleConfirm = () => {
    const { onConfirm } = this.props;
    const { includeSender, customMessage, selectedRelations } = this.state;

    onConfirm({
      includeSender,
      customMessage,
      includeRelations: selectedRelations
    });
  }

  handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      this.props.onCancel();
    }
  }

  render() {
    const { onCancel } = this.props;
    const { loading, recipients, includeSender, customMessage, emailPreview, error, availableRelations, selectedRelations } = this.state;

    return e('div', {
      className: 'modal-overlay',
      onClick: this.handleOverlayClick
    },
      e('div', {
        className: 'modal-content notify-modal-content',
        onClick: (e) => e.stopPropagation(),
        style: {
          padding: '0',
          maxWidth: '1000px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }
      },
        // Header
        e('div', {
          className: 'modal-header notify-modal-header',
          style: {
            padding: '20px 24px',
            flexShrink: 0
          }
        },
          e('h2', {
            style: {
              margin: 0,
              fontSize: '20px',
              fontWeight: 'bold'
            }
          }, '📧 Envoyer une notification')
        ),

        // Two-column layout container
        e('div', {
          className: 'notify-modal-body',
          style: {
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
            minHeight: 0
          }
        },

          // Loading state
          loading && e('div', {
            style: {
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px'
            }
          }, '⏳ Chargement des destinataires...'),

          // Error state
          error && e('div', {
            className: 'error',
            style: {
              flex: 1,
              margin: '20px',
              padding: '20px'
            }
          }, error),

          // Left column: Parameters
          !loading && !error && e('div', {
            className: 'notify-params-column',
            style: {
              flex: '0 0 400px',
              padding: '20px 24px',
              overflow: 'auto',
              borderRight: '1px solid var(--color-border)'
            }
          },
          // Recipients list
          e('div', {
            key: 'recipients',
            style: { marginBottom: '20px' }
          },
            e('h3', {
              style: {
                margin: '0 0 12px 0',
                fontSize: '16px',
                color: '#333'
              }
            }, `Destinataires (${recipients.length})`),

            recipients.length === 0
              ? e('p', {
                  style: {
                    color: '#999',
                    fontStyle: 'italic',
                    margin: '12px 0'
                  }
                }, 'Aucun destinataire trouvé')
              : e('div', {
                  style: {
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    padding: '12px',
                    maxHeight: '200px',
                    overflow: 'auto'
                  }
                },
                recipients.map((recipient, idx) =>
                  e('div', {
                    key: recipient.id || idx,
                    style: {
                      padding: '6px 0',
                      borderBottom: idx < recipients.length - 1 ? '1px solid #e9ecef' : 'none',
                      fontSize: '14px'
                    }
                  },
                    e('div', {
                      style: { fontWeight: 'bold', color: '#333' }
                    }, recipient.name),
                    e('div', {
                      style: { color: '#666', fontSize: '12px' }
                    }, recipient.email)
                  )
                )
              )
          ),

          // Include sender checkbox
          e('div', {
            key: 'include-sender',
            style: {
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }
          },
            e('input', {
              type: 'checkbox',
              id: 'includeSender',
              checked: includeSender,
              onChange: this.handleIncludeSenderChange,
              style: { cursor: 'pointer' }
            }),
            e('label', {
              htmlFor: 'includeSender',
              style: {
                cursor: 'pointer',
                fontSize: '14px',
                color: '#333'
              }
            }, 'M\'inclure dans les destinataires')
          ),

          // Custom message
          e('div', {
            key: 'custom-message',
            style: { marginBottom: '20px' }
          },
            e('label', {
              htmlFor: 'customMessage',
              style: {
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }
            }, 'Message personnalisé (optionnel)'),
            e('textarea', {
              id: 'customMessage',
              value: customMessage,
              onChange: this.handleMessageChange,
              placeholder: 'Ajoutez un message qui sera inclus dans l\'email...',
              rows: 4,
              style: {
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }
            })
          ),

          // Relations selector
          availableRelations.length > 0 && e('div', {
            key: 'relations-selector',
            style: { marginBottom: '20px' }
          },
            e('label', {
              style: {
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }
            }, 'Relations à inclure dans l\'email'),
            e('div', {
              style: {
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }
            },
              availableRelations.map(relation =>
                e('div', {
                  key: relation.arrayName,
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }
                },
                  e('input', {
                    type: 'checkbox',
                    id: `relation-${relation.arrayName}`,
                    checked: selectedRelations.includes(relation.arrayName),
                    onChange: () => this.handleRelationToggle(relation.arrayName),
                    style: { cursor: 'pointer' }
                  }),
                  e('label', {
                    htmlFor: `relation-${relation.arrayName}`,
                    style: {
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#333',
                      flex: 1
                    }
                  },
                    `${relation.table} (${relation.arrayName})`,
                    relation.isStrong && e('span', {
                      style: {
                        marginLeft: '8px',
                        fontSize: '11px',
                        color: '#28a745',
                        fontWeight: 'bold'
                      }
                    }, '★ Strong')
                  )
                )
              )
            )
          )),

          // Right column: Preview
          !loading && !error && e('div', {
            className: 'notify-preview-column',
            style: {
              flex: 1,
              padding: '20px 24px',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }
          },
            e('h3', {
              style: {
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: 'bold'
              }
            }, '📄 Aperçu du message'),
            emailPreview && e('iframe', {
              srcDoc: emailPreview,
              style: {
                flex: 1,
                width: '100%',
                minHeight: '400px',
                border: '1px solid var(--color-border)',
                borderRadius: '4px'
              },
              sandbox: 'allow-same-origin',
              scrolling: 'auto'
            })
          )
        ),

        // Footer with buttons
        !loading && !error && e('div', {
          className: 'modal-footer',
          style: {
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            padding: '16px 24px',
            flexShrink: 0
          }
        },
          e('button', {
            onClick: onCancel,
            className: 'btn-cancel'
          }, 'Annuler'),
          e('button', {
            onClick: this.handleConfirm,
            disabled: recipients.length === 0,
            className: 'btn-primary',
            style: {
              opacity: recipients.length === 0 ? 0.5 : 1,
              cursor: recipients.length === 0 ? 'not-allowed' : 'pointer'
            }
          }, `📧 Envoyer (${recipients.length})`)
        )
      )
    );
  }
}

// Export the component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotifyModal;
}

// Export to global scope for use in other components
if (typeof window !== 'undefined') {
  window.NotifyModal = NotifyModal;
}

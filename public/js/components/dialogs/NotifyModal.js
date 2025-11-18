/**
 * NotifyModal Component
 *
 * Modal dialog for sending email notifications about a record.
 * Shows preview of recipients and allows customization of the notification.
 *
 * Dependencies:
 * - React (global)
 *
 * @component
 */

const e = React.createElement;

class NotifyModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      recipients: [],
      includeSender: false,
      customMessage: '',
      error: null
    };
  }

  async componentDidMount() {
    await this.loadRecipients();
  }

  async loadRecipients() {
    const { tableName, rowId } = this.props;
    const { includeSender } = this.state;

    this.setState({ loading: true, error: null });

    try {
      const response = await fetch(
        `/_api/${tableName}/${rowId}/notify/preview?includeSender=${includeSender}`
      );

      const data = await response.json();

      if (data.success) {
        this.setState({
          recipients: data.recipients || [],
          loading: false
        });
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
  }

  handleConfirm = () => {
    const { onConfirm } = this.props;
    const { includeSender, customMessage } = this.state;

    onConfirm({
      includeSender,
      customMessage
    });
  }

  handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      this.props.onCancel();
    }
  }

  render() {
    const { onCancel } = this.props;
    const { loading, recipients, includeSender, customMessage, error } = this.state;

    return e('div', {
      className: 'modal-overlay',
      onClick: this.handleOverlayClick,
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }
    },
      e('div', {
        className: 'modal-content',
        onClick: (e) => e.stopPropagation(),
        style: {
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }
      },
        // Header
        e('div', {
          style: {
            borderBottom: '2px solid #007bff',
            paddingBottom: '12px',
            marginBottom: '20px'
          }
        },
          e('h2', {
            style: {
              margin: 0,
              color: '#007bff',
              fontSize: '20px',
              fontWeight: 'bold'
            }
          }, '📧 Envoyer une notification')
        ),

        // Loading state
        loading && e('div', {
          style: {
            textAlign: 'center',
            padding: '40px 20px',
            color: '#666'
          }
        }, '⏳ Chargement des destinataires...'),

        // Error state
        error && e('div', {
          style: {
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            padding: '12px',
            color: '#721c24',
            marginBottom: '16px'
          }
        }, `❌ ${error}`),

        // Content
        !loading && !error && [
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

          // Buttons
          e('div', {
            key: 'buttons',
            style: {
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              marginTop: '24px'
            }
          },
            e('button', {
              onClick: onCancel,
              style: {
                padding: '8px 16px',
                border: '1px solid #6c757d',
                borderRadius: '4px',
                backgroundColor: 'white',
                color: '#6c757d',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }
            }, 'Annuler'),
            e('button', {
              onClick: this.handleConfirm,
              disabled: recipients.length === 0,
              style: {
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: recipients.length === 0 ? '#ccc' : '#007bff',
                color: 'white',
                cursor: recipients.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }
            }, `📧 Envoyer (${recipients.length})`)
          )
        ]
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

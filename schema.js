module.exports = {
  // Configuration générale de l'application
  appName: "Crudable Site",
  version: "2.0.0",
  country: "FR",
  languages: "fr", // pourra devenir un tableau
  seo: "schema.org microdata",
  maxRows: 1000,
  maxColWidth: "20em",
  maxColHeight: "2em",
  naming: ["camelCase","PascalCase"],

  // Configuration email marketing
  emailRateLimit: 120, // Limite d'envoi par heure (contrainte hébergeur)

  // Enregistrement automatique avec debounce  + sauvegarde garantie
  autosave: 500, // debounce en ms 
  // Actions disponibles pour le système d'autorisation
  actions: ["read", "create", "update", "delete", "publish"], 

  // Système RBAC - Role-Based Access Control avec héritage des autorisations
  roles: {
    "public": { "description": "Accès public", "inherits": [] },
    "member": { "description": "Membres inscrits gratuits", "inherits": ["public"] },
    "premium": { "description": "Membres payants", "inherits": ["member"] },
    "promo": { "description": "Équipe promotion", "inherits": ["premium"] },
    "road": { "description": "Équipe de tournée", "inherits": ["premium"] },
    "admin": { "description": "Équipe administrative", "inherits": ["promo", "road"] },
    "dir": { "description": "Direction", "inherits": ["admin"] },
    "dev": { "description": "Développeurs", "inherits": ["dir"] }
  },

  // fields communs à toutes les tables
  commonFields: {
    ownerId: { type: "integer" }, // id du créateur de la fiche géré par le sysème
    granted: { type: "varchar", default: "draft" }, // Système d'autorisation: draft, shared, published @role
    createdAt: { type: "datetime", default: "CURRENT_TIMESTAMP" },
    updatedAt: { type: "datetime", default: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" }
  },
  // granted for rows :
  // draft : appartient à ownerId, lui seul peut lire, modifier, supprimer
  // shared : adopte le granted de la table
  // published @role : readable pour @role ou descendants de l'héritage 
  // => grâce à published, une row peut donc devenir lisible par un user même si le granted de sa table l'interdit à priori


  defaultConfigTable : {
    displayFields: ["name"], // identifiant utilisateur, peut être un array (par exemple pour symboliser un lien n:1)
    searchFields: null, // par défaut tous les champs varchar ou text de la structure
    pageSize: 100, // nombre maximum de fiches par page (bouton +lignes pour ajouter dynamiquement)
    dateFormat: "fr",
    cardWidth: "600px",
    maxColWidth: "300px", // largeur maximale des colonnes dans les listes
    maxColHeight: "100px", // hauteur maximale des colonnes dans les listes
    publishableTo: ["public", "member", "premium"], // pour quels rôle les rows de la table peut êre publiée
    granted: { // niveau maximum de protection par defaut
      "dev": ["read", "create", "update", "delete", "publish"]
    },
    hasAttachmentsTab: true, // peut-on attacher des pièces jointes à chaque row ?
  },

  users: { // comment trouver les users ?
    table: "Person",
    fields: ["email","password"],
    displayFields:["givenName", "familyName"],
    profil: ["givenName", "familyName","telephone","email","password"],
    cookieMaxAge: 34646400,
    menuStyle: "popup", 
    position: "top right",
  },

  menu: {
    page: "Page", // chercher les pages dans cette table
    section: "Section", // chercher les sections de page  // mais implicite puisque lien Strong
    style: "hamburger",
    position: "top right",
    animate: "slidein",
    content:["pages","tables"] // selon granted

  },

  calendar: {
    granted: {
      admin: ["read", "create"]
    },
    firstDayInWeek:1 // 1 = Lundi, 0 = Dimanche
  },

  renderer: {
    image: "<img class='field-label image {{key}}' src='{{value}}' alt='{{value}}' />",
    email: "<a class='field-label email {{key}}' href='mailto:{{value}}'> 📧 {{value}}</a>",
    telephone: "<a class='field-label telephone {{key}}' href='tel:{{value}}'> 📞 {{value}}</a>",
    url: "<a class='field-label url {{key}}' href='{{value}}' target='_blank'>🔗 {{value}}</a>",
    date: "<time class='field-label date {{key}}' datetime='{{value}}'>{{value}}</time>",
    datetime: "<time class='field-label datetime {{key}}' datetime='{{value}}'>{{value}}</time>",
    time: "<time class='field-label time {{key}}'>{{value}}</time>",
    boolean: "<span class='field-label boolean {{key}} {{#value}}true{{/value}}{{^value}}false{{/value}}'>{{#value}}✓{{/value}}{{^value}}✗{{/value}}</span>",
    number: "<span class='field-label number {{key}}'>{{value}}</span>",
    currency: "<span class='field-label currency {{key}}'>{{value}} €</span>",
    percentage: "<span class='field-label percentage {{key}}'>{{value}}%</span>",
    filePreview: "#filePreview"
  },

  // Tables de l'application
  tables: {
    Page: {
      granted:{
        public: ["read"],
        dev: ["read", "create", "update", "delete", "publish"]
      },

      // ... defaultConfigTable
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        slug: { type: "varchar" }, // URL slug pour la page (ex: "albums", "concerts")
        name: { type: "varchar" }, // Titre de la page
        description: { type: "text" }, // Description de la page
        mustache: { type: "text" }, // Template Mustache optionnel pour le rendu personnalisé
        css: { type: "text" }, // CSS personnalisé optionnel pour la page
        position: { type: "integer", default: 0 }, // Ordre d'affichage dans le menu
        // ... commonFields
      }
    },
    Section: {
      granted:{
        public: ["read"],
        dev: ["read", "create", "update", "delete", "publish"]
      },
      // ... defaultConfigTable
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        idPage: {
          type: "integer",
          relation: "Page",
          foreignKey: "id",
          arrayName: "sections",
          relationshipStrength: "Strong",
          defaultSort: { field: "position", order: "ASC" },
          orderable: "position"
        },
        name: { type: "varchar" }, // Nom de la section
        description: { type: "text" }, // Description de la section
        slug: { type: "varchar" }, // Version compactée du name pour l'URL
        sqlTable: { type: "varchar" }, // Nom de la table à afficher (ancien: tableName)
        sqlWhere: { type: "text" }, // Clause WHERE optionnelle - mustachable (ancien: whereClause)
        sqlOrderBy: { type: "varchar" }, // Clause ORDER BY optionnelle - mustachable (ancien: orderBy)
        sqlLimit: { type: "integer" }, // Nombre maximum d'enregistrements - mustachable (ancien: limit)
        sqlQueryRaw: { type: "text" }, // Query brut qui bypass le système des tables - mustachable
        apiRelations: { type: "text" }, // Liste des relations à inclure (ex: "byArtist,recordLabel") (ancien: relations)
        apiCompact: { type: "integer", default: 0 }, // Format réduit pour les liens n:1 (0 ou 1)
        apiSchema: { type: "integer", default: 0 }, // Inclure le schéma dans la réponse (0 ou 1)
        apiNoSystemFields: { type: "integer", default: 0 }, // Retirer les champs système (ownerId, granted, createdAt, updatedAt) (0 ou 1)
        apiNoId: { type: "integer", default: 0 }, // Retirer le champ id (0 ou 1)
        reqQuery: { type: "text" }, // JSON des req.query par défaut pour mustacher le query
        apiData: { type: "text" }, // JSON optionnel utilisé en substitution du résultat si sqlTable/sqlQuery vides
        presentationType: { type: "enum", values: ["cards", "list", "table", "grid"], default: "cards" }, // Type de présentation
        mustache: { type: "text" }, // Template Mustache optionnel pour le rendu personnalisé
        position: { type: "integer", default: 0 }, // Ordre d'affichage dans la page
        // ... commonFields
      }
    },
    Person: {
      // ... defaultConfigTable
      displayFields: ["givenName", "familyName"],
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        givenName: { type: "varchar" },
        familyName: { type: "varchar" },
        fullName: { type: "varchar", as: "CONCAT(COALESCE(givenName, ''), ' ', COALESCE(familyName, ''))" }, // Champ calculé SQL
        description: { type: "text" },
        image: { type: "varchar", renderer: "image" }, // Photo de profil
        email: { type: "varchar", renderer: "email" },
        telephone: { type: "varchar", renderer: "telephone" },
        password: { type: "varchar", grant: { "dev": ["read", "create", "update"], "admin": ["read", "create", "update"] } }, // Mot de passe en clair (phase de développement)
        roles: { type: "varchar" }, // Liste des rôles séparés par des espaces (ex: "@admin @dev")
        theme: { type: "varchar", default: "light" }, // Préférence de thème: "light" ou "dark"
        isActive: { type: "integer", default: 1 }, // 0 ou 1 pour actif/inactif
        isSubscribed: { type: "integer", default: 0 }, // 0 ou 1 pour newsletter
        isSubscribedAt: { type: "datetime" }, // Date d'inscription à la newsletter
        // ... commonFields
      }
    },
    Organization: {
      // ... defaultConfigTable
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" },
        description: { type: "text" },
        image: { type: "varchar", renderer: "image" }, // Logo de l'organisation
        memberCount: {
          type: "integer",
          calculate: async function(row, context) {
            // Compter le nombre de membres de cette organisation
            const [result] = await context.pool.query(
              'SELECT COUNT(*) as count FROM OrganizationPerson WHERE idOrganization = ?',
              [row.id]
            );
            return result[0].count;
          },
          stat: "sum" // Exemple de statistique : somme de tous les membres
        }, // Champ calculé JavaScript avec statistique
        // ... commonFields
      }
    },
    OrganizationPerson: {
      // ... defaultConfigTable
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      hasAttachmentsTab: false, // Table de liaison - pas besoin d'attachments
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true, stat: "count" }, // Exemple: compter le nombre de relations
        position: { type: "integer" },
        organizationRole: { type: "varchar" },
          idOrganization: { 
          type: "integer", 
          relation: "Organization", 
          foreignKey: "id", 
          arrayName: "member", 
          relationshipStrength: "Strong", 
          defaultSort: { field: "position", order: "ASC" },
          orderable: "position"
        },
        idPerson: { 
          type: "integer", 
          relation: "Person", 
          foreignKey: "id", 
          arrayName: "memberOf", 
          relationshipStrength: "Weak", 
          defaultSort: { field: "organizationRole", order: "ASC" } },
      
        
          // ... commonFields
      }
    },
    CommunicateAction: {
      // ... defaultConfigTable
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        date: { type: "datetime" },
        idPerson: { type: "integer", relation: "Person", foreignKey: "id", arrayName: "CommunicateAction", relationshipStrength: "Weak", defaultSort: { field: "date", order: "DESC" } },
        idProject: { type: "integer", relation: "Project", foreignKey: "id", arrayName: "CommunicateAction", relationshipStrength: "Weak", defaultSort: { field: "date", order: "DESC" } },
        instrument: { type: "enum", values: ["Phone", "Email", "Meeting", "Mail", "Visio"] },
        description: { type: "text" },
        outcome: { type: "text" },
          // + commonFields
      }
    },
    Project: {
      // ... defaultConfigTable
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" },
        description: { type: "text" },
        image: { type: "varchar", renderer: "image" }, // Image du projet
          // + commonFields
      }
    },
    Contrat: {
      // ... defaultConfigTable
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" },
        description: { type: "text" },
        date: { type: "datetime" },
        organisateur: { type: "integer", relation: "Organization", foreignKey: "id", arrayName: "Contrats comme Organisateur", relationshipStrength: "Weak", defaultSort: { field: "date", order: "DESC" } },
        producteur: { type: "integer", relation: "Organization", foreignKey: "id", arrayName: "Contrats comme Producteur", relationshipStrength: "Weak", defaultSort: { field: "date", order: "DESC" } },
          // + commonFields
      }
    },
    Notes: {
      // ... defaultConfigTable
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: {
        "promo": ["read", "create", "update", "delete"],
        "road": ["read", "create", "update", "delete"],
        "admin": ["publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" },
        description: { type: "text", renderer: "markdown" },
        url: { type: "varchar", renderer: "url"},
        // ... commonFields
      }
    },
    MusicAlbum: {
      displayFields: ["name"],
      searchFields: ["name", "description", "genre"],
      pageSize: 50,
      dateFormat: "fr",
      cardWidth: "600px",
      publishableTo: ["public", "member", "premium"],
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" }, // schemaorgProperty: name
        description: { type: "text" }, // schemaorgProperty: description
        byArtist: { type: "integer", relation: "Organization", foreignKey: "id", arrayName: "Albums", relationshipStrength: "Weak", defaultSort: { field: "datePublished", order: "DESC" } }, // schemaorgProperty: byArtist, peut pointer vers MusicGroup (Organization) ou Person
        datePublished: { type: "date" }, // schemaorgProperty: datePublished
        genre: { type: "varchar" }, // schemaorgProperty: genre
        recordLabel: { type: "integer", relation: "Organization", foreignKey: "id", arrayName: "Albums produits", relationshipStrength: "Weak" }, // schemaorgProperty: recordLabel
        url: { type: "varchar", renderer: "url" }, // schemaorgProperty: url
        image: { type: "varchar", renderer: "image" }, // schemaorgProperty: image
        duration: { type: "varchar" }, // schemaorgProperty: duration (format ISO 8601: PT37M53S)
        // + commonFields
      }
    },
    MusicRecording: {
      // ... defaultConfigTable
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" }, // schemaorgProperty: name
        description: { type: "text" }, // schemaorgProperty: description
        image: { type: "varchar", renderer: "image" }, // schemaorgProperty: image - Artwork de l'enregistrement
        duration: { type: "varchar" }, // schemaorgProperty: duration (format ISO 8601: PT3M29S)
        byArtist: { type: "integer", relation: "Organization", foreignKey: "id", arrayName: "Enregistrements", relationshipStrength: "Weak" }, // schemaorgProperty: byArtist
        // ... commonFields
      }
    },
    MusicAlbumTrack: {
      // ... defaultConfigTable
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      hasAttachmentsTab: false, // Table de liaison - pas besoin d'attachments
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        position: { type: "integer", default: 0 }, // Position de la piste dans l'album
        idMusicAlbum: {
          type: "integer",
          relation: "MusicAlbum",
          foreignKey: "id",
          arrayName: "track", // le nom de la propriété dans le lequel est rangé les rows liées
          arraySchemaorgProperty: "track", // nom selon doctrine schema.org (pour microdata)
          relationshipStrength: "Strong", // signifie une contagion du DELETE et une DUPLICATION en chaine
          defaultSort: {
            field: "position",
            order: "ASC"
          },  // si string = {field:<value>, order:"ASC"} // si array [ {field1, order1}, {field2, order2}]
          orderable: "position"
        },
      
        idMusicRecording: { 
          type: "integer", 
          relation: "MusicRecording", 
          foreignKey: "id", 
          arrayName: "inAlbum", 
          arraySchemaorgProperty: "inAlbum",
          relationshipStrength: "Weak", 
          defaultSort: { 
            field: "position", 
            order: "ASC"  
          },  // si string = {field:<value>, order:"ASC"} // si array [ {field1, order1}, {field2, order2}]
          orderable: "position",
          label: "Enregistrement (idMusicRecording)",
        },
      
        // ... commonFields
      }
    },
    Attachment: {
      // ... defaultConfigTable

      hasAttachmentsTab: false, // Les attachments eux-mêmes n'ont pas besoin d'attachments
      granted: {
        "member": ["read", "create", "update", "delete"],
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        rowLink: { type: "varchar", renderer: "rowLink", readonly: true }, // Lien vers l'enregistrement parent (ex: "Person/1") - DEPRECATED: utiliser les relations ci-dessous
        name: { type: "varchar" }, // Nom du fichier (modifiable, permet de renommer)
        fileType: { type: "varchar", readonly: true }, // Type MIME (image/jpeg, application/pdf, etc.)
        fileSize: { type: "integer", readonly: true }, // Taille en octets
        filePath: { type: "varchar", renderer: "filePreview", readonly: true }, // Chemin du fichier sur le système de fichiers
      },
    },
    Event: {
      // Configuration de table selon schema.org Event
      displayFields: ["name"],
      searchFields: ["name", "description", "location"],
      pageSize: 50,
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: {
        "member": ["read"],
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      calendar: {
        bgColor: "coral",
        startDate: "startDate", // valeur par défaut
        endDate: "endDate" // valeur par défaut
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        startDate: { type: "datetime", renderer: "datetime" }, // schemaorgProperty: startDate
        endDate: { type: "datetime", renderer: "datetime" }, // schemaorgProperty: endDate
        name: { type: "varchar" }, // schemaorgProperty: name - Nom de l'événement
        description: { type: "text" }, // schemaorgProperty: description
        location: { type: "varchar" }, // schemaorgProperty: location (peut être un lieu ou une adresse)
        organizer: {
          type: "integer",
          relation: "Organization",
          foreignKey: "id",
          arrayName: "organizedEvents",
          relationshipStrength: "Weak"
        }, // schemaorgProperty: organizer
        performer: {
          type: "integer",
          relation: "Organization",
          foreignKey: "id",
          arrayName: "performedEvents",
          relationshipStrength: "Weak"
        }, // schemaorgProperty: performer (peut être Person ou Organization)
        url: { type: "varchar", renderer: "url" }, // schemaorgProperty: url
        image: { type: "varchar", renderer: "image" }, // schemaorgProperty: image
        eventStatus: {
          type: "enum",
          values: ["EventScheduled", "EventCancelled", "EventPostponed", "EventRescheduled"],
          default: "EventScheduled"
        }, // schemaorgProperty: eventStatus
        eventAttendanceMode: {
          type: "enum",
          values: ["OfflineEventAttendanceMode", "OnlineEventAttendanceMode", "MixedEventAttendanceMode"],
          default: "OfflineEventAttendanceMode"
        }, // schemaorgProperty: eventAttendanceMode
        // + commonFields
      }
    },
    Todo: {
      // Table de gestion des tâches à faire
      displayFields: ["name"],
      searchFields: ["name", "description"],
      pageSize: 100,
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      calendar: {
        bgColor: "lightblue",
        startDate: "startDate",
        endDate: "endDate"
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        startDate: { type: "datetime", renderer: "datetime" }, // Date de début
        endDate: { type: "datetime", renderer: "datetime" }, // Date de fin
        name: { type: "varchar" }, // Nom de la tâche
        description: { type: "text" }, // Description de la tâche
        image: { type: "varchar", renderer: "image" }, // Image associée à la tâche
        // + commonFields
      }
    },

    Trip:{
      displayFields: ["name"],
      pageSize: 300,
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      calendar: {
        bgColor: "yellow",
        startDate: "departureTime",
        endDate: "arrivalTime"
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        departureTime: { type: "datetime", renderer: "datetime" }, 
        arrivalTime: { type: "datetime", renderer: "datetime" }, 
        
        subType:{
          type: "enum", 
          values:["BoatTrip","BusTrip","Flight", "TouristTrip","TrainTrip"]
        },
        name: { type: "varchar" }, // Nom de la tâche
        description: { type: "text" }, // Description de la tâche,
      }
    },  
    itinerary:{
      
      pageSize: 500,
      hasAttachmentsTab: false, // Permet d'attacher des pièces jointes
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        position:{ type: "integer" },
        Trip: {
          type: "integer",
          relation: "Trip",
          foreignKey: "id",
          arrayName: "itinerary",
          relationshipStrength: "Strong",
          defaultSort: { field: "position", order: "ASC" },
          orderable: "position",
        },
        Place: {
          type: "integer",
          relation: "Place",
          foreignKey: "id",
          arrayName: "partOfTrip",
          relationshipStrength: "Weak"
        } 
      }
    },
    Place : {
      displayFields: ["name"],
      pageSize: 300,
      hasAttachmentsTab: true, // Permet d'attacher des pièces jointes
      granted: { "admin": ["read", "create", "update", "delete", "publish"] },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" }, // Nom de la tâche
        description: { type: "text" }, // Description de la tâche,
        image: { type: "varchar", renderer: "image" }, // Image du lieu
        "streetAddress": { type: "text", wrapper:{name: "address", type: "PostalAddress"} },
        "postalCode": { type: "varchar(10)", wrapper:{name: "address", type: "PostalAddress"} },
        "addressLocality": { type: "varchar", wrapper:{name: "address", type: "PostalAddress"} },
        "addressCountry": { type: "varchar", wrapper:{name: "address", type: "PostalAddress"} },
        mapLink: { type: "varchar", renderer: "url" }, // Lien vers une carte (Google Maps, OpenStreetMap, etc.)  
      }
    },

    // ========================================
    // SYSTÈME DE NEWSLETTER & EMAIL MARKETING
    // ========================================

    Newsletter: {
      displayFields: ["name"],
      searchFields: ["title", "subject"],
      pageSize: 50,
      hasAttachmentsTab: false,
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar", length: 255 }, // Titre interne (ex: "Newsletter Février 2025")
        subject: { type: "varchar", length: 255 }, // Sujet de l'email
        content: { type: "text", renderer: "markdown" }, // Contenu principal en markdown
        bodyTemplate: { type: "text" }, // Template Mustache du corps de l'email
        scheduledAt: { type: "datetime" }, // Date programmée pour l'envoi
        status: {
          type: "enum",
          values: ["draft", "queued", "sending", "sent", "paused", "cancelled"],
          default: "draft"
        }, // Statut de la newsletter
        totalRecipients: { type: "integer", default: 0 }, // Nombre total de destinataires
        sentCount: { type: "integer", default: 0 }, // Nombre d'emails envoyés
        openedCount: { type: "integer", default: 0 }, // Nombre d'ouvertures (tracking pixel)
        failedCount: { type: "integer", default: 0 }, // Nombre d'échecs
        // ... commonFields
      }
    },

    News: {
      displayFields: ["title"],
      searchFields: ["title", "content"],
      pageSize: 100,
      hasAttachmentsTab: true,
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"],
        "member": ["read"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        image: { type: "varchar", renderer: "image" },
        title: { type: "varchar", length: 255 },
        content: { type: "text", renderer: "markdown" },
        publishedAt: { type: "datetime" },
        url: { type: "varchar", renderer: "url" },
        // ... commonFields
      }
    },

    NewsletterNews: {
      // Table de liaison Newsletter <-> News (relation 1:N)
      displayFields: ["newsletterId", "newsId"],
      hasAttachmentsTab: false,
      granted: {
        "admin": ["read", "create", "update", "delete"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        newsletterId: {
          type: "integer",
          relation: "Newsletter",
          foreignKey: "id",
          arrayName: "news",
          relationshipStrength: "Strong", // Suppression en cascade
          defaultSort: { field: "displayOrder", order: "ASC" },
          orderable: "displayOrder"
        },
        newsId: {
          type: "integer",
          relation: "News",
          foreignKey: "id",
          arrayName: "inNewsletters",
          relationshipStrength: "Weak"
        },
        displayOrder: { type: "integer", default: 0 }, // Ordre d'affichage dans la newsletter
        // ... commonFields
      }
    },

    EmailQueue: {
      // File d'attente des emails à envoyer
      displayFields: ["recipientEmail", "status"],
      searchFields: ["recipientEmail"],
      pageSize: 100,
      hasAttachmentsTab: false,
      granted: {
        "admin": ["read", "create", "update", "delete"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        newsletterId: {
          type: "integer",
          relation: "Newsletter",
          foreignKey: "id",
          arrayName: "emailQueue",
          relationshipStrength: "Strong"
        },
        recipientId: {
          type: "integer",
          relation: "Person",
          foreignKey: "id",
          arrayName: "emailsReceived",
          relationshipStrength: "Weak"
        },
        recipientEmail: { type: "varchar", length: 255 }, // Email dupliqué pour optimisation
        recipientData: { type: "json" }, // Données pour personnalisation Mustache: {givenName, familyName, ...}
        status: {
          type: "enum",
          values: ["pending", "sent", "failed", "skipped"],
          default: "pending"
        },
        sentAt: { type: "datetime" }, // Date d'envoi réel
        openedAt: { type: "datetime" }, // Date de première ouverture (tracking pixel)
        openCount: { type: "integer", default: 0 }, // Nombre d'ouvertures
        errorMessage: { type: "text" }, // Message d'erreur en cas d'échec
        retryCount: { type: "integer", default: 0 }, // Nombre de tentatives
        // ... commonFields
      }
    },

    EmailRateTracker: {
      // Suivi des limites d'envoi horaires
      displayFields: ["hourSlot", "emailsSent"],
      hasAttachmentsTab: false,
      granted: {
        "admin": ["read", "create", "update", "delete"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        hourSlot: { type: "datetime" }, // Heure arrondie (ex: 2025-02-15 14:00:00)
        emailsSent: { type: "integer", default: 0 }, // Nombre d'emails envoyés pendant cette heure
        lastEmailAt: { type: "datetime" }, // Timestamp du dernier email envoyé
        // ... commonFields
      }
    }
  }
};

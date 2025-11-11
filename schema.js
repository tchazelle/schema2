module.exports = {
  // Configuration générale de l'application
  appName: "Crudable Site",
  version: "2.0.0",
  country: "FR",
  languages: "fr", // pourra devenir un tableau
  seo: "schema.org microdata",

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


  defaultConfigPage : {
    displayField: "name", // identifiant utilisateur, peut être un array (par exemple pour symboliser un lien n:1)
    searchFields: null, // par défaut tous les champs varchar ou text de la structure
    pageSize: 100, // nombre maximum de fiches par page (bouton +lignes pour ajouter dynamiquement)
    dateFormat: "fr",
    cardWidth: "600px",
    publishableTo: ["public", "member", "premium"], // pour quels rôle les rows de la table peut êre publiée
    granted: { // niveau maximum de protection par defaut
      "dev": ["read", "create", "update", "delete", "publish"]
    },
    hasAttachmentsTab: false, // peut-on attacher des pièces jointes à chaque row ?
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
    table: "Pages",
    tableContent: "Section",
    style: "hamburger", 
    position: "top left",
    animate: "slidein",
    content:["pages","tables"] // selon granted

  },

  renderer: { // interprétation BABEL pour React ?
    image: "<img src='{{value}}' />",
    email: "<span><a href='mailto:{{value}}'> 📧 </a>{{value}}</span>",
    telephone: "<span><a href='tel:{{value}}'> 📞 </a>{{value}}</span>",
    url: "<span><a href='tel:{{value}}'> 🔗 </a> {{value}}</span>",
    filePreview:"#filePreview" // appel fonction nodejs ?
  },

  // Tables de l'application
  tables: {
    Page: {
      // ... defaultConfigPage
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
      // ... defaultConfigPage
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        idPage: {
          type: "integer",
          relation: "Page",
          foreignKey: "id",
          arrayName: "sections",
          relationshipStrength: "Strong",
          defaultSort: { field: "sectionOrder", order: "ASC" }
        },
        title: { type: "varchar" }, // Titre de la section
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
        reqQuery: { type: "text" }, // JSON des req.query par défaut pour mustacher le query
        apiData: { type: "text" }, // JSON optionnel utilisé en substitution du résultat si sqlTable/sqlQuery vides
        presentationType: { type: "enum", values: ["cards", "list", "table", "grid"], default: "cards" }, // Type de présentation
        mustache: { type: "text" }, // Template Mustache optionnel pour le rendu personnalisé
        sectionOrder: { type: "integer", default: 0 }, // Ordre d'affichage dans la page
        // ... commonFields
      }
    },
    Person: {
      // ... defaultConfigPage
      displayField:["givenName","familyName"],
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        givenName: { type: "varchar" },
        familyName: { type: "varchar" },
        fullName: { type: "varchar", as: "CONCAT(COALESCE(givenName, ''), ' ', COALESCE(familyName, ''))" }, // Champ calculé SQL
        description: { type: "text" },
        email: { type: "varchar", renderer: "email" },
        telephone: { type: "varchar", renderer: "telephone" },
        password: { type: "varchar", grant: { "dev": ["read", "create", "update"], "admin": ["read", "create", "update"] } }, // Mot de passe en clair (phase de développement)
        roles: { type: "varchar" }, // Liste des rôles séparés par des espaces (ex: "@admin @dev")
        isActive: { type: "integer", default: 1 }, // 0 ou 1 pour actif/inactif
        // ... commonFields
      }
    },
    Organization: {
      // ... defaultConfigPage
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" },
        description: { type: "text" },
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
      // ... defaultConfigPage
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      hasAttachmentsTab: false, // Table de liaison - pas besoin d'attachments
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true, stat: "count" }, // Exemple: compter le nombre de relations
        idPerson: { type: "integer", relation: "Person", foreignKey: "id", arrayName: "memberOf", relationshipStrength: "Weak", defaultSort: { field: "organizationRole", order: "ASC" } },
        idOrganization: { type: "integer", relation: "Organization", foreignKey: "id", arrayName: "member", relationshipStrength: "Weak", defaultSort: { field: "organizationRole", order: "ASC" } },
        organizationRole: { type: "varchar" },
          // ... commonFields
      }
    },
    CommunicateAction: {
      // ... defaultConfigPage
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
      // ... defaultConfigPage
      granted: {
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" },
        description: { type: "text" },
          // + commonFields
      }
    },
    Contrat: {
      // ... defaultConfigPage
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
      // ... defaultConfigPage
      granted: {
        "promo": ["read", "create", "update", "delete"],
        "road": ["read", "create", "update", "delete"],
        "admin": ["publish"]
      },  
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" },
        description: { type: "text" },
        // ... commonFields
      }
    },
    MusicAlbum: {
      displayField: "name",
      searchFields: ["name", "description", "genre"],
      pageSize: 50,
      dateFormat: "fr",
      cardWidth: "600px",
      publishableTo: ["public", "member", "premium"],
      granted: {
        "member": ["read"],
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
      // ... defaultConfigPage
      granted: {
        "public" : ["read"],
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        name: { type: "varchar" }, // schemaorgProperty: name
        description: { type: "text" }, // schemaorgProperty: description
        duration: { type: "varchar" }, // schemaorgProperty: duration (format ISO 8601: PT3M29S)
        byArtist: { type: "integer", relation: "Organization", foreignKey: "id", arrayName: "Enregistrements", relationshipStrength: "Weak" }, // schemaorgProperty: byArtist
        // ... commonFields
      }
    },
    MusicAlbumTrack: {
      // ... defaultConfigPage
      granted: {
        "public" : ["read"],
        "admin": ["read", "create", "update", "delete", "publish"]
      },
      hasAttachmentsTab: false, // Table de liaison - pas besoin d'attachments
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        idMusicAlbum: { 
          type: "integer", 
          relation: "MusicAlbum", 
          foreignKey: "id", 
          arrayName: "track", // le nom de la propriété dans le lequel est rangé les rows liées
          arraySchemaorgProperty: "track", // nom selon doctrine schema.org (pour microdata)
          relationshipStrength: "Strong", // signifie une contagion du DELETE et une DUPLICATION en chaine
          defaultSort: 
          { field: "position", order: "ASC" }  // si string = {field:<value>, order:"ASC"} // si array [ {field1, order1}, {field2, order2}]
        },
        idMusicRecording: { 
          type: "integer", 
          relation: "MusicRecording", 
          foreignKey: "id", 
          arrayName: "inAlbum", 
          arraySchemaorgProperty: "inAlbum",
          relationshipStrength: "Weak", 
          defaultSort: { field: "position", order: "ASC" }, 
          label: "Enregistrement" 
        },
        position: { type: "integer", default: 0 }, // Position de la piste dans l'album
        // ... commonFields
      }
    },
    Attachment: {
      // ... defaultConfigPage
      granted: {"inherit":"rowLink"}, // cas particulier , autorisation = celle de rowLink
      hasAttachmentsTab: false, // Table de liaison - pas besoin d'attachments
      hasAttachmentsTab: false, // Les attachments eux-mêmes n'ont pas besoin d'attachments
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        rowLink: { type: "varchar", renderer: "rowLink" }, // Lien vers l'enregistrement parent (ex: "Person/1")
        fileName: { type: "varchar" }, // Nom du fichier original
        fileType: { type: "varchar" }, // Type MIME (image/jpeg, application/pdf, etc.)
        fileSize: { type: "integer" }, // Taille en octets
        filePath: { type: "varchar", renderer: "filePreview" }, // Chemin du fichier sur le système de fichiers
        // + commonFields
      }
    },
  }
};

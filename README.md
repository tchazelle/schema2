# Schema2 Backend - Node.js

Backend Node.js avec système d'authentification JWT et gestion des autorisations RBAC basé sur schema.js.

## Fonctionnalités

- ✅ Authentification JWT avec cookies
- ✅ Système RBAC (Role-Based Access Control) avec héritage des rôles
- ✅ Pool de connexions MySQL2
- ✅ Interface web minimaliste
- ✅ Menu hamburger dynamique (pages et tables selon autorisations)
- ✅ Menu utilisateur avec connexion/déconnexion
- ✅ Routes de debug pour visualiser les autorisations

## Structure du projet

```
schema2/
├── config/
│   └── database.js          # Configuration du pool MySQL2
├── routes/
│   ├── index.js             # Route principale (/)
│   ├── auth.js              # Routes d'authentification
│   └── debug.js             # Routes de debug
├── utils/
│   ├── auth.js              # Utilitaires JWT et cookies
│   └── permissions.js       # Gestion des permissions RBAC
├── public/                  # Fichiers statiques
├── schema.js                # Schéma de l'application
├── server.js                # Serveur Express principal
├── .env                     # Variables d'environnement
├── .gitignore              # Fichiers ignorés par git
└── package.json            # Dépendances npm

## Installation

1. Installer les dépendances :
```bash
npm install
```

2. Configurer le fichier `.env` (déjà créé) :
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=schema2
DB_PORT=8889
DB_TIMEZONE=+00:00
JWT_SECRET=dev-secret-key-change-in-production
UPLOADS_DIR=./uploads
```

3. S'assurer que la base de données MySQL existe et contient la table `Person` :
```sql
CREATE TABLE IF NOT EXISTS Person (
  id INT PRIMARY KEY AUTO_INCREMENT,
  givenName VARCHAR(255),
  familyName VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  telephone VARCHAR(50),
  password VARCHAR(255),
  roles VARCHAR(255),
  isActive INT DEFAULT 1,
  ownerId INT,
  granted VARCHAR(50) DEFAULT 'draft',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

4. Créer un utilisateur de test :
```sql
INSERT INTO Person (givenName, familyName, email, password, roles, isActive)
VALUES ('Admin', 'User', 'admin@example.com', 'admin123', '@admin @dev', 1);
```

## Démarrage

### Mode développement (avec nodemon) :
```bash
npm run dev
```

### Mode production :
```bash
npm start
```

Le serveur démarre sur `http://localhost:3000`

## Routes disponibles

### Routes publiques

- `GET /` - Page d'accueil avec menu et authentification
- `POST /auth/login` - Connexion (JSON: {email, password})
- `POST /auth/logout` - Déconnexion

### Routes protégées

- `GET /auth/me` - Informations de l'utilisateur connecté
- `GET /debug/user` - Fiche détaillée de l'utilisateur
- `GET /debug/user/grant` - Autorisations héritées de l'utilisateur

## Système de rôles

Les rôles sont définis dans `schema.js` avec héritage :

```
dev → dir → admin → promo, road → premium → member → public
```

- **public** : Accès public
- **member** : Membres inscrits gratuits
- **premium** : Membres payants
- **promo** : Équipe promotion
- **road** : Équipe de tournée
- **admin** : Équipe administrative
- **dir** : Direction
- **dev** : Développeurs

## Autorisations

Les autorisations sont définies par table et par action :
- `read` : Lecture
- `create` : Création
- `update` : Modification
- `delete` : Suppression
- `publish` : Publication

Exemple pour la table `Person` :
```javascript
granted: {
  "admin": ["read", "create", "update", "delete", "publish"]
}
```

## Sécurité

⚠️ **Important** : Ce code est conçu pour le développement. En production :

1. Utilisez bcrypt pour hasher les mots de passe (déjà installé dans `package.json`)
2. Changez le `JWT_SECRET` dans `.env` par une clé sécurisée
3. Activez HTTPS (les cookies sont en `secure: false` en développement)
4. Ajoutez des validations et sanitisation des entrées
5. Ajoutez un rate limiting pour les tentatives de connexion

## Technologies utilisées

- **Express** : Framework web
- **MySQL2** : Driver MySQL avec support des Promises
- **JWT** : Authentification par token
- **Cookie-parser** : Gestion des cookies
- **Bcrypt** : Hash des mots de passe (à activer)
- **Dotenv** : Variables d'environnement

## Développement futur

- [ ] Hash des mots de passe avec bcrypt
- [ ] Gestion complète des pages dynamiques
- [ ] CRUD complet pour les tables
- [ ] Upload de fichiers
- [ ] API REST complète
- [ ] Tests unitaires et d'intégration

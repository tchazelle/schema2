/**
 * Proxy pour transformer les données de l'API en format optimisé pour Mustache
 *
 * Transformations effectuées :
 * 1. Relations 1:n deviennent des propriétés directes (ex: member[] au lieu de relations.member[])
 * 2. Relations n:1 remplacent la clé porteuse (ex: idPerson devient un objet Person)
 * 3. Les éléments des relations 1:n sont également proxifiés
 * 4. La clé "relations" est masquée de l'énumération SEULEMENT si c'est un objet (relations API)
 * 5. Le champ "relations" (type string/text de la DB) est accessible normalement
 */

/**
 * Crée un proxy pour une donnée API
 * @param {Object|Array} data - Données à proxifier (row ou array de rows)
 * @returns {Proxy} - Données proxifiées pour Mustache
 */
function createDataForMustacheProxy(data) {
  // Si c'est un tableau, proxifier chaque élément
  if (Array.isArray(data)) {
    return data.map(item => createDataForMustacheProxy(item));
  }

  // Si ce n'est pas un objet, retourner tel quel
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Créer le proxy pour cet objet
  return new Proxy(data, {
    /**
     * Intercepteur de lecture de propriété
     */
    get(target, prop, receiver) {
      // Si on accède à "relations"
      if (prop === 'relations') {
        // Si c'est une chaîne (champ DB), la retourner normalement
        if (typeof target.relations === 'string') {
          return target.relations;
        }
        // Si c'est un objet (relations API), le masquer
        return undefined;
      }

      // Si la propriété existe directement, la retourner
      if (prop in target && prop !== 'relations') {
        const value = target[prop];

        // Si c'est un objet ou un tableau, le proxifier aussi
        if (value && typeof value === 'object') {
          return createDataForMustacheProxy(value);
        }

        return value;
      }

      // Sinon, chercher dans les relations (seulement si c'est un objet, pas une chaîne)
      if (target.relations && typeof target.relations === 'object') {
        // 1. Chercher dans les relations 1:n (arrays)
        if (target.relations[prop] && Array.isArray(target.relations[prop])) {
          // Proxifier chaque élément du tableau
          return createDataForMustacheProxy(target.relations[prop]);
        }

        // 2. Chercher dans les relations n:1 (objets)
        if (target.relations[prop] && typeof target.relations[prop] === 'object') {
          return createDataForMustacheProxy(target.relations[prop]);
        }
      }

      // Propriété non trouvée
      return undefined;
    },

    /**
     * Intercepteur d'énumération (Object.keys, for...in, etc.)
     * Cache la clé "relations" (si objet API) et expose les relations comme propriétés directes
     */
    ownKeys(target) {
      // Si relations est une chaîne (champ DB), ne pas la filtrer
      const keys = typeof target.relations === 'string'
        ? Object.keys(target)
        : Object.keys(target).filter(key => key !== 'relations');

      // Ajouter les clés des relations comme propriétés directes (seulement si c'est un objet API)
      if (target.relations && typeof target.relations === 'object') {
        for (const relKey in target.relations) {
          if (!keys.includes(relKey)) {
            keys.push(relKey);
          }
        }
      }

      return keys;
    },

    /**
     * Intercepteur de getOwnPropertyDescriptor
     * Nécessaire pour que Object.keys fonctionne correctement
     */
    getOwnPropertyDescriptor(target, prop) {
      // Si c'est la clé "relations"
      if (prop === 'relations') {
        // Si c'est une chaîne (champ DB), la retourner normalement
        if (typeof target.relations === 'string') {
          return Object.getOwnPropertyDescriptor(target, prop) || {
            enumerable: true,
            configurable: true
          };
        }
        // Si c'est un objet (relations API), la masquer
        return undefined;
      }

      // Si la propriété existe directement
      if (prop in target && prop !== 'relations') {
        return Object.getOwnPropertyDescriptor(target, prop) || {
          enumerable: true,
          configurable: true
        };
      }

      // Si c'est une relation (seulement si c'est un objet API)
      if (target.relations && typeof target.relations === 'object' && prop in target.relations) {
        return {
          enumerable: true,
          configurable: true
        };
      }

      return undefined;
    },

    /**
     * Intercepteur de has (opérateur 'in')
     */
    has(target, prop) {
      // Si c'est "relations"
      if (prop === 'relations') {
        // Si c'est une chaîne (champ DB), elle existe
        if (typeof target.relations === 'string') {
          return true;
        }
        // Si c'est un objet (relations API), elle n'existe pas dans le proxy
        return false;
      }

      // Vérifier si la propriété existe directement
      if (prop in target && prop !== 'relations') {
        return true;
      }

      // Vérifier dans les relations (seulement si c'est un objet API)
      if (target.relations && typeof target.relations === 'object' && prop in target.relations) {
        return true;
      }

      return false;
    }
  });
}

/**
 * Transforme une réponse complète de l'API
 * @param {Object} apiResponse - Réponse de l'API (avec data, pagination, etc.)
 * @returns {Object} - Réponse avec data proxifiée
 */
function transformApiResponse(apiResponse) {
  if (!apiResponse || typeof apiResponse !== 'object') {
    return apiResponse;
  }

  const transformed = { ...apiResponse };

  // Proxifier le champ "data" s'il existe
  if (transformed.data) {
    transformed.data = createDataForMustacheProxy(transformed.data);
  }

  return transformed;
}

module.exports = {
  createDataForMustacheProxy,
  transformApiResponse
};

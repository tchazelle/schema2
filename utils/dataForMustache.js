/**
 * Proxy pour transformer les données de l'API en format optimisé pour Mustache
 *
 * Transformations effectuées :
 * 1. Relations 1:n deviennent des propriétés directes (ex: member[] au lieu de _relations.member[])
 * 2. Relations n:1 remplacent la clé porteuse (ex: idPerson devient un objet Person)
 * 3. Les éléments des relations 1:n sont également proxifiés
 * 4. La clé "_relations" est masquée de l'énumération
 *
 * Note: L'objet API utilise "_relations" pour éviter tout conflit avec un éventuel champ "relations" en DB
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
      // Si on accède à "_relations", le masquer (toujours)
      if (prop === '_relations') {
        return undefined;
      }

      // Si la propriété existe directement, la retourner
      if (prop in target && prop !== '_relations') {
        const value = target[prop];

        // Si c'est un objet ou un tableau, le proxifier aussi
        if (value && typeof value === 'object') {
          return createDataForMustacheProxy(value);
        }

        return value;
      }

      // Sinon, chercher dans _relations
      if (target._relations) {
        // 1. Chercher dans les relations 1:n (arrays)
        if (target._relations[prop] && Array.isArray(target._relations[prop])) {
          // Proxifier chaque élément du tableau
          return createDataForMustacheProxy(target._relations[prop]);
        }

        // 2. Chercher dans les relations n:1 (objets)
        if (target._relations[prop] && typeof target._relations[prop] === 'object') {
          return createDataForMustacheProxy(target._relations[prop]);
        }
      }

      // Propriété non trouvée
      return undefined;
    },

    /**
     * Intercepteur d'énumération (Object.keys, for...in, etc.)
     * Cache la clé "_relations" et expose les relations comme propriétés directes
     */
    ownKeys(target) {
      // Filtrer _relations de l'énumération
      const keys = Object.keys(target).filter(key => key !== '_relations');

      // Ajouter les clés des relations comme propriétés directes
      if (target._relations) {
        for (const relKey in target._relations) {
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
      // Si c'est la clé "_relations", la masquer
      if (prop === '_relations') {
        return undefined;
      }

      // Si la propriété existe directement
      if (prop in target && prop !== '_relations') {
        return Object.getOwnPropertyDescriptor(target, prop) || {
          enumerable: true,
          configurable: true
        };
      }

      // Si c'est une relation
      if (target._relations && prop in target._relations) {
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
      // "_relations" n'existe pas dans le proxy
      if (prop === '_relations') {
        return false;
      }

      // Vérifier si la propriété existe directement
      if (prop in target && prop !== '_relations') {
        return true;
      }

      // Vérifier dans _relations
      if (target._relations && prop in target._relations) {
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

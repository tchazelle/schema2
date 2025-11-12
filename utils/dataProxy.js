function dataProxy(data) {
  const isObject = val => val && typeof val === 'object';

  // Proxyfie tout en profondeur AVANT d'appliquer les handlers
  function deepWrap(value) {
    if (Array.isArray(value)) {
      return value.map(deepWrap);
    } else if (isObject(value)) {
      // Clone superficiel pour éviter de garder les anciennes références
      const clone = {};
      for (const key of Object.keys(value)) {
        if (key === '_relations') continue; // on l'ignore ici
        clone[key] = deepWrap(value[key]);
      }

      // On proxyfie maintenant ce clone
      return new Proxy(clone, {
        get(target, prop) {
          if (prop === '_relations') return undefined;
          const rels = value._relations; // les relations originales
          if (rels && prop in rels) return deepWrap(rels[prop]);
          return Reflect.get(target, prop);
        },
        ownKeys(target) {
          const rels = value._relations;
          const keys = new Set([
            ...Object.keys(target),
            ...(rels ? Object.keys(rels) : [])
          ]);
          keys.delete('_relations');
          return Array.from(keys);
        },
        getOwnPropertyDescriptor(target, prop) {
          if (prop === '_relations') return undefined;
          return { enumerable: true, configurable: true };
        }
      });
    } else {
      return value;
    }
  }

  return deepWrap(data);
}

module.exports = {
  dataProxy
};

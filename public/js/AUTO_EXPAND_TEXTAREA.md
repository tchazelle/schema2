# Auto-Expand Textarea

Utilitaire JavaScript pour auto-agrandir les textareas en fonction de leur contenu.

## Fonctionnalités

- ✅ Auto-expansion en temps réel lors de la saisie
- ✅ Gestion du contenu initial au chargement
- ✅ Support des textareas ajoutés dynamiquement (React, DOM)
- ✅ Transitions douces de hauteur
- ✅ Hauteur minimum/maximum configurable
- ✅ Pas de scrollbar si pas nécessaire
- ✅ Responsive (réajuste sur resize)

## Installation

Le script est automatiquement chargé sur toutes les pages CRUD via `templateService.js`.

```html
<!-- Déjà inclus dans les pages CRUD -->
<script src="/js/autoExpandTextarea.js"></script>
```

## Utilisation

### Mode automatique (par défaut)

Le script s'initialise automatiquement au chargement de la page et applique l'auto-expansion à **tous les textareas** :

```javascript
// Aucune action requise, fonctionne automatiquement !
```

### Mode manuel

Pour désactiver l'auto-initialisation et contrôler manuellement :

```javascript
// Dans votre HTML, avant le script :
<script>
  window.AUTO_EXPAND_DISABLED = true;
</script>
<script src="/js/autoExpandTextarea.js"></script>

// Puis initialisez manuellement :
AutoExpandTextarea.init();
```

### Configuration personnalisée

```javascript
// Configurer les paramètres globaux
AutoExpandTextarea.init({
  selector: 'textarea',        // Sélecteur CSS
  minHeight: 80,               // Hauteur minimum (px)
  maxHeight: 400,              // Hauteur maximum (px, null = illimité)
  extraPadding: 4              // Padding supplémentaire
});
```

### Appliquer à un textarea spécifique

```javascript
const textarea = document.querySelector('#myTextarea');
AutoExpandTextarea.apply(textarea);

// Avec options personnalisées
AutoExpandTextarea.apply(textarea, {
  minHeight: 100,
  maxHeight: 300
});
```

### Forcer le redimensionnement

```javascript
const textarea = document.querySelector('#myTextarea');
AutoExpandTextarea.resize(textarea);
```

### Supprimer l'auto-expansion

```javascript
const textarea = document.querySelector('#myTextarea');
AutoExpandTextarea.destroy(textarea);
```

## Intégration avec React

Le script fonctionne automatiquement avec les composants React grâce à `MutationObserver` :

```javascript
// Dans EditForm.js ou CreateFormModal.js
e('textarea', {
  className: 'edit-field-textarea',
  value: value || '',
  onChange: (e) => this.handleFieldChange(fieldName, e.target.value),
  ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
})
// L'auto-expansion sera appliquée automatiquement !
```

Si vous voulez forcer un resize après un changement de valeur programmatique :

```javascript
componentDidUpdate(prevProps) {
  if (prevProps.value !== this.props.value) {
    const textarea = this.fieldRefs[fieldName];
    if (textarea) {
      AutoExpandTextarea.resize(textarea);
    }
  }
}
```

## Configuration CSS

Les textareas doivent avoir ces styles de base (déjà présents dans `crud.css`) :

```css
.edit-field-textarea {
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
}
```

Le script ajoute automatiquement :
- `overflow: hidden` (ou `auto` si max-height atteint)
- `resize: none` (désactive le resize manuel)
- `transition: height 0.1s ease` (animation douce)

## Exemples d'utilisation

### Exemple 1 : Textarea avec hauteur limitée

```javascript
AutoExpandTextarea.apply(textarea, {
  minHeight: 60,
  maxHeight: 200
});
```

### Exemple 2 : Textarea sans limite

```javascript
AutoExpandTextarea.apply(textarea, {
  minHeight: 80,
  maxHeight: null  // Expansion illimitée
});
```

### Exemple 3 : Application à une classe spécifique

```javascript
AutoExpandTextarea.init({
  selector: '.auto-expand-textarea',
  minHeight: 100
});
```

## Compatibilité

- ✅ Chrome, Firefox, Safari, Edge (versions récentes)
- ✅ React 16+ (via `MutationObserver`)
- ✅ Fonctionne avec les frameworks CSS (Bootstrap, Tailwind, etc.)

## Troubleshooting

### Le textarea ne s'agrandit pas

Vérifiez que :
1. Le script est bien chargé (`window.AutoExpandTextarea` existe)
2. Le textarea n'a pas `overflow: scroll` ou `resize: vertical` en CSS
3. Le textarea n'a pas `height` fixe en inline style

### Le textarea est trop petit au départ

Augmentez le `minHeight` :

```javascript
AutoExpandTextarea.configure({
  minHeight: 120
});
```

### Le textarea scintille pendant la saisie

Augmentez le `extraPadding` :

```javascript
AutoExpandTextarea.configure({
  extraPadding: 8
});
```

## API Reference

### `AutoExpandTextarea.init(options)`

Initialise l'auto-expansion sur tous les textareas correspondant au sélecteur.

**Paramètres :**
- `options.selector` (string) : Sélecteur CSS (défaut : `'textarea'`)
- `options.minHeight` (number) : Hauteur minimum en pixels (défaut : `80`)
- `options.maxHeight` (number|null) : Hauteur maximum en pixels (défaut : `null`)
- `options.extraPadding` (number) : Padding supplémentaire (défaut : `4`)

### `AutoExpandTextarea.apply(textarea, config)`

Applique l'auto-expansion à un textarea spécifique.

**Paramètres :**
- `textarea` (HTMLTextAreaElement) : L'élément textarea
- `config` (Object) : Configuration (optionnel)

### `AutoExpandTextarea.destroy(textarea)`

Supprime l'auto-expansion d'un textarea.

**Paramètres :**
- `textarea` (HTMLTextAreaElement) : L'élément textarea

### `AutoExpandTextarea.resize(textarea)`

Force le redimensionnement d'un textarea.

**Paramètres :**
- `textarea` (HTMLTextAreaElement) : L'élément textarea

### `AutoExpandTextarea.configure(options)`

Met à jour la configuration globale.

**Paramètres :**
- `options` (Object) : Nouvelles options

## Changelog

### Version 1.0.0 (2025-11-19)

- ✨ Première version
- ✅ Auto-expansion sur input
- ✅ Support des textareas dynamiques
- ✅ Configuration min/max height
- ✅ Intégration React automatique

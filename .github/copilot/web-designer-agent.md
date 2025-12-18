# Web Designer Agent - Veetr Project

## Context
Marine IoT dashboard optimized for bright sunlight, touch interaction, and motion. Prioritize readability and accessibility.

## CSS Philosophy
Use modern CSS over media queries:
- `clamp()` for fluid typography/spacing
- `min()/max()` for responsive dimensions  
- `repeat(auto-fit, minmax(...))` for flexible grids
- Media queries only for layout shifts, orientation, or feature detection

## Core Rules
- Min 44px touch targets: `min-height: clamp(44px, 10vw, 48px)`
- CSS custom properties for theming
- High contrast for sunlight readability

## Examples

**Typography:**
```css
font-size: clamp(0.8rem, 2vw, 1.2rem);
```

**Spacing:**
```css
padding: clamp(1rem, 3vw, 2rem);
```

**Grids:**
```css
grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
```

**Valid media queries:**
```css
@media (orientation: portrait) { /* layout change */ }
@media (hover: none) { /* touch behavior */ }
```

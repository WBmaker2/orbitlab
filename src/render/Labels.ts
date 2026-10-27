import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export function createLabel(text: string, className: string): CSS2DObject {
  const element = document.createElement('div');
  element.className = `scene-label ${className}`;
  element.textContent = text;
  element.setAttribute('aria-hidden', 'true');
  const label = new CSS2DObject(element);
  label.center.set(0.5, 1);
  return label;
}

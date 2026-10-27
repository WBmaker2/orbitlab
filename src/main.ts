import './ui/styles/main.css';
import { App } from './app/App';

const root = document.getElementById('app');
if (root) {
  new App(root);
}

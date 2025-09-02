import { Searching } from './searching/searching';
import { TabManagement } from './tab_management';

class Popup {
  constructor() {
    new TabManagement();
    new Searching();
  }
}

document.addEventListener('DOMContentLoaded', () => new Popup());

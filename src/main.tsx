import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './components/App.tsx'

// Import pgn-viewer required CSS
import 'chessground/assets/chessground.base.css'
import 'chessground/assets/chessground.brown.css'
import 'chessground/assets/chessground.cburnett.css'

// Add custom CSS to fix pgn-viewer board height issue
const style = document.createElement('style');
style.textContent = `
  /* Fix pgn-viewer chessground container height issue */
  cg-container {
    height: 400px !important;
    width: 400px !important;
  }
  
  .cg-wrap {
    height: 400px !important;
    width: 400px !important;
  }
  
  /* Ensure the board is visible */
  .board {
    height: 400px !important;
    width: 400px !important;
  }
  
  /* Fix coordinate positioning - move them outside the board */
  .cg-wrap coords.ranks {
    right: -20px !important;
  }
  
  .cg-wrap coords.files {
    bottom: -20px !important;
  }
  
  /* Add some padding to the board container to make room for coordinates */
  .cg-wrap {
    padding: 0 25px 25px 0 !important;
  }
`;
document.head.appendChild(style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

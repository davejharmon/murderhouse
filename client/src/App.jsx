// client/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import Landing from './pages/Landing';
import Player from './pages/Player';
import Host from './pages/Host';
import Screen from './pages/Screen';
import './styles/global.css';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/host" element={<Host />} />
          <Route path="/screen" element={<Screen />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}

// client/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import Landing from './pages/Landing';
import Player from './pages/Player';
import Host from './pages/Host';
import HostPad from './pages/HostPad';
import Screen from './pages/Screen';
import DebugGrid from './pages/DebugGrid';
import Operator from './pages/Operator';
import SlideEditor from './pages/SlideEditor';
import StringSheets from './pages/StringSheets';
import './styles/global.css';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/host" element={<Host />} />
          <Route path="/hostpad" element={<HostPad />} />
          <Route path="/screen" element={<Screen />} />
          <Route path="/debug" element={<DebugGrid />} />
          <Route path="/operator" element={<Operator />} />
          <Route path="/slides" element={<SlideEditor />} />
          <Route path="/strings" element={<StringSheets />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}

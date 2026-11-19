import Background from './components/Background';
import Cabinet from './pages/Cabinet';
import Landing from './pages/Landing';
import { usePath } from './router';
import './styles.css';

export default function App() {
  const path = usePath();
  const inCabinet = path === '/cabinet' || path.startsWith('/cabinet/');

  return (
    <>
      {/* Shared, persistent background so switching pages never re-initialises WebGL. */}
      <div className="backdrop" aria-hidden="true">
        <span className="light light-a" />
        <span className="light light-b" />
        <span className="light light-c" />
      </div>
      <Background />
      {inCabinet ? <Cabinet path={path} /> : <Landing />}
    </>
  );
}

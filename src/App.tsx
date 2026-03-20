import { useEffect } from 'react';
import Canvas from './canvas/Canvas';
import { useDiagramStore } from './store/diagramStore';

function App() {
  useEffect(() => {
    const { addNode, addEdge, expandNode } = useDiagramStore.getState();

    // --- seed: a small system architecture diagram ---

    const frontend = addNode({ label: 'Frontend', x: 80, y: 180, width: 150, height: 70 });

    // Backend is a container with two children visible inside it
    const backend = addNode({ label: 'Backend', x: 320, y: 100, width: 190, height: 220 });
    addNode({ label: 'API', x: 25, y: 40, width: 140, height: 60, parentId: backend });
    addNode({ label: 'Auth', x: 25, y: 130, width: 140, height: 60, parentId: backend });
    expandNode(backend);

    const db = addNode({ label: 'Database', x: 620, y: 180, width: 150, height: 70 });
    const cache = addNode({ label: 'Cache', x: 620, y: 320, width: 150, height: 70 });

    addEdge(frontend, backend, 'REST');
    addEdge(backend, db, 'SQL');
    addEdge(backend, cache, 'Redis');
  }, []);

  return <Canvas />;
}

export default App;

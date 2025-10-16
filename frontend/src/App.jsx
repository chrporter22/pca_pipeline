import { useEffect, useState } from 'react';
import './index.css';

function App() {
  const [data, setData] = useState([]);
  const [compX, setCompX] = useState(1);
  const [compY, setCompY] = useState(2);

  useEffect(() => {
    fetch("http://localhost:3001/api/pca")
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const width = 800, height = 400;

  const xValues = data.map(d => d[`pca_${compX}`]);
  const yValues = data.map(d => d[`pca_${compY}`]);

  const minX = Math.min(...xValues), maxX = Math.max(...xValues);
  const minY = Math.min(...yValues), maxY = Math.max(...yValues);

  return (
    <div className="bg-black text-green-400 font-mono min-h-screen p-8">
      <h1 className="text-3xl mb-4">PCA Component Viewer</h1>

      <div className="mb-4 flex gap-4">
        <label>
          X Component:
          <input
            type="number"
            min="1"
            max="5"
            value={compX}
            onChange={(e) => setCompX(+e.target.value)}
            className="ml-2 p-1 bg-gray-800 text-green-300"
          />
        </label>
        <label>
          Y Component:
          <input
            type="number"
            min="1"
            max="5"
            value={compY}
            onChange={(e) => setCompY(+e.target.value)}
            className="ml-2 p-1 bg-gray-800 text-green-300"
          />
        </label>
      </div>

      <svg width={width} height={height} className="bg-gray-900 rounded">
        {data.map((d, i) => {
          const x = ((d[`pca_${compX}`] - minX) / (maxX - minX)) * width;
          const y = height - ((d[`pca_${compY}`] - minY) / (maxY - minY)) * height;
          return <circle key={i} cx={x} cy={y} r="3" fill="lime" />;
        })}
      </svg>
    </div>
  );
}

export default App;

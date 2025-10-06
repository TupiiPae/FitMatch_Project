import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => setStats(data));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>FitMatch Admin</h1>
      <pre>{JSON.stringify(stats, null, 2)}</pre>
    </div>
  );
}

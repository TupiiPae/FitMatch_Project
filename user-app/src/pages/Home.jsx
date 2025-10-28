import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Home() {
  const [me, setMe] = useState(null);
  useEffect(() => { api.get('/user/me').then(({ data }) => setMe(data)); }, []);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">FitMatch</h1>
      <pre className="mt-4 bg-gray-100 p-4 rounded">{JSON.stringify(me, null, 2)}</pre>
    </div>
  );
}

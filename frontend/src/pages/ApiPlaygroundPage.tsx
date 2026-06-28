import React from 'react';
import { ApiPlayground } from '../components/ApiPlayground';

const ApiPlaygroundPage: React.FC = () => (
  <ApiPlayground baseUrl={import.meta.env.VITE_API_BASE_URL ?? ''} />
);

export default ApiPlaygroundPage;

import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, ApiResponse, ExampleRequest, HistoryEntry } from './types';
import { RequestBuilder } from './RequestBuilder';
import { ResponseViewer } from './ResponseViewer';
import { RequestHistory } from './RequestHistory';
import { ExampleRequests } from './ExampleRequests';

const DEFAULT_REQUEST: ApiRequest = {
  id: uuidv4(),
  name: 'Untitled request',
  method: 'GET',
  url: '/api/contracts/wastes',
  headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
  queryParams: [
    { key: 'page', value: '1', enabled: true },
    { key: 'limit', value: '20', enabled: true },
  ],
  body: '',
  auth: { type: 'none' },
};

function buildUrl(baseUrl: string, req: ApiRequest): string {
  const enabledParams = req.queryParams.filter((p) => p.enabled && p.key);
  if (enabledParams.length === 0) return baseUrl + req.url;
  const qs = new URLSearchParams(enabledParams.map((p) => [p.key, p.value])).toString();
  return `${baseUrl}${req.url}?${qs}`;
}

function buildHeaders(req: ApiRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const h of req.headers) {
    if (h.enabled && h.key) headers[h.key] = h.value;
  }
  if (req.auth.type === 'bearer' && req.auth.token) {
    headers['Authorization'] = `Bearer ${req.auth.token}`;
  }
  if (req.auth.type === 'api_key' && req.auth.apiKey) {
    headers['X-API-Key'] = req.auth.apiKey;
  }
  if (req.auth.type === 'stellar' && req.auth.stellarPublicKey) {
    headers['X-Stellar-Public-Key'] = req.auth.stellarPublicKey;
  }
  return headers;
}

type PanelView = 'examples' | 'history';

export const ApiPlayground: React.FC<{ baseUrl?: string }> = ({
  baseUrl = window.location.origin,
}) => {
  const [request, setRequest] = useState<ApiRequest>(DEFAULT_REQUEST);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [panel, setPanel] = useState<PanelView>('examples');

  const sendRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    const startMs = performance.now();
    let res: ApiResponse | null = null;
    let err: string | null = null;

    try {
      const url = buildUrl(baseUrl, request);
      const headers = buildHeaders(request);
      const hasBody = !['GET', 'DELETE'].includes(request.method) && request.body.trim();

      const fetchRes = await fetch(url, {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
      });

      const durationMs = Math.round(performance.now() - startMs);
      const body = await fetchRes.text();
      const responseHeaders: Record<string, string> = {};
      fetchRes.headers.forEach((v, k) => { responseHeaders[k] = v; });

      res = {
        status: fetchRes.status,
        statusText: fetchRes.statusText,
        headers: responseHeaders,
        body,
        durationMs,
        timestamp: new Date().toISOString(),
      };
      setResponse(res);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
      setError(err);
    } finally {
      setLoading(false);
      const entry: HistoryEntry = {
        id: uuidv4(),
        request: { ...request },
        response: res,
        error: err,
        timestamp: new Date().toISOString(),
      };
      setHistory((prev) => [...prev, entry]);
    }
  }, [request, baseUrl]);

  const loadExample = (example: ExampleRequest) => {
    setRequest({
      id: uuidv4(),
      name: example.name,
      ...example.request,
    });
    setResponse(null);
    setError(null);
  };

  const loadHistoryEntry = (entry: HistoryEntry) => {
    setRequest({ ...entry.request, id: uuidv4() });
    setResponse(entry.response);
    setError(entry.error);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">API Playground</h1>
          <p className="text-sm text-gray-500 mt-1">
            Explore and test Scavenger REST endpoints interactively.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left panel: examples / history */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
              {(['examples', 'history'] as PanelView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setPanel(v)}
                  className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                    panel === v ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {panel === 'examples' ? (
              <ExampleRequests onLoad={loadExample} />
            ) : (
              <RequestHistory
                history={history}
                onSelect={loadHistoryEntry}
                onClear={() => setHistory([])}
              />
            )}
          </div>

          {/* Right panel: request + response */}
          <div className="lg:col-span-3 space-y-4">
            <RequestBuilder
              request={request}
              onChange={setRequest}
              onSend={sendRequest}
              loading={loading}
            />
            <ResponseViewer response={response} error={error} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiPlayground;

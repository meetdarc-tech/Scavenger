import { useState } from 'react'
import {
  Users,
  Package,
  Gift,
  Settings,
  ShieldAlert,
  Activity,
  Search,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Cpu,
  Database,
  Wifi,
  UserX,
  UserCheck,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useContract } from '@/context/ContractContext'
import { useWallet } from '@/context/WalletContext'
import { useAuth } from '@/context/AuthContext'
import { networkConfig } from '@/lib/stellar'
import { wasteTypeLabel, formatDate, formatAddress } from '@/lib/helpers'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAppTitle } from '@/hooks/useAppTitle'
import type { GlobalMetrics, Incentive } from '@/api/types'

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useAdminMetrics() {
  const { config } = useContract()
  return useQuery<GlobalMetrics>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getMetrics()
    },
    staleTime: 30_000,
  })
}

function useAdminIncentives() {
  const { config } = useContract()
  return useQuery<Incentive[]>({
    queryKey: ['admin-incentives'],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getActiveIncentives()
    },
    staleTime: 30_000,
  })
}

// ── Audit log (local session only) ───────────────────────────────────────────

interface AuditEntry {
  id: number
  action: string
  target: string
  timestamp: number
}

let _auditId = 0
const _auditLog: AuditEntry[] = []

function addAuditEntry(action: string, target: string) {
  _auditLog.unshift({ id: ++_auditId, action, target, timestamp: Date.now() / 1000 })
  if (_auditLog.length > 50) _auditLog.pop()
}

// ── Mock data for new features ────────────────────────────────────────────────

interface MockUser {
  address: string
  role: string
  name: string
  status: 'active' | 'suspended'
  joined: number
}

const MOCK_USERS: MockUser[] = [
  { address: 'GABC...1234', role: 'Recycler', name: 'Alice Green', status: 'active', joined: Date.now() / 1000 - 86400 * 30 },
  { address: 'GDEF...5678', role: 'Collector', name: 'Bob Smith', status: 'active', joined: Date.now() / 1000 - 86400 * 15 },
  { address: 'GHIJ...9012', role: 'Manufacturer', name: 'Carol White', status: 'suspended', joined: Date.now() / 1000 - 86400 * 60 },
  { address: 'GKLM...3456', role: 'Recycler', name: 'Dave Brown', status: 'active', joined: Date.now() / 1000 - 86400 * 7 },
]

interface Dispute {
  id: number
  wastId: number
  reporter: string
  description: string
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: number
}

const MOCK_DISPUTES: Dispute[] = [
  { id: 1, wastId: 42, reporter: 'GABC...1234', description: 'Weight reported does not match actual', status: 'open', createdAt: Date.now() / 1000 - 3600 },
  { id: 2, wastId: 17, reporter: 'GDEF...5678', description: 'Location coordinates are incorrect', status: 'open', createdAt: Date.now() / 1000 - 7200 },
  { id: 3, wastId: 8, reporter: 'GHIJ...9012', description: 'Waste type mislabeled', status: 'resolved', createdAt: Date.now() / 1000 - 86400 },
]

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'users' | 'disputes' | 'wastes' | 'incentives' | 'health' | 'config' | 'audit'

const TABS: { id: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { id: 'disputes', label: 'Disputes', icon: <AlertTriangle className="h-4 w-4" /> },
  { id: 'wastes', label: 'Wastes', icon: <Package className="h-4 w-4" /> },
  { id: 'incentives', label: 'Incentives', icon: <Gift className="h-4 w-4" /> },
  { id: 'health', label: 'System Health', icon: <Heart className="h-4 w-4" /> },
  { id: 'config', label: 'Config', icon: <Settings className="h-4 w-4" />, adminOnly: true },
  { id: 'audit', label: 'Audit Log', icon: <ShieldAlert className="h-4 w-4" /> },
]

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: metrics, isLoading } = useAdminMetrics()

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Total Wastes"
          value={isLoading ? '—' : String(metrics?.total_wastes_count ?? 0)}
          isLoading={isLoading}
        />
        <StatCard
          icon={<Gift className="h-4 w-4" />}
          label="Total Tokens Earned"
          value={isLoading ? '—' : String(metrics?.total_tokens_earned ?? 0n)}
          variant="primary"
          isLoading={isLoading}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Registered Users"
          value={MOCK_USERS.length}
          variant="success"
          isLoading={false}
        />
      </div>
    </div>
  )
}

// ── User Management tab ───────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS)
  const [search, setSearch] = useState('')

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.address.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  )

  function toggleStatus(address: string) {
    setUsers((prev) =>
      prev.map((u) =>
        u.address === address
          ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' }
          : u
      )
    )
    addAuditEntry('toggle_user_status', address)
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name, address or role…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search users"
      />
      <div className="divide-y divide-border rounded-lg border">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No users found.</p>
        ) : (
          filtered.map((u) => (
            <div key={u.address} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {u.address} · {u.role} · Joined {formatDate(u.joined)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={u.status === 'active' ? 'default' : 'outline'}>
                  {u.status}
                </Badge>
                <Button
                  size="sm"
                  variant={u.status === 'active' ? 'destructive' : 'outline'}
                  onClick={() => toggleStatus(u.address)}
                  aria-label={u.status === 'active' ? 'Suspend user' : 'Reactivate user'}
                >
                  {u.status === 'active' ? (
                    <UserX className="h-3.5 w-3.5" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Disputes tab ──────────────────────────────────────────────────────────────

function DisputesTab() {
  const [disputes, setDisputes] = useState<Dispute[]>(MOCK_DISPUTES)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')

  const displayed = filter === 'all' ? disputes : disputes.filter((d) => d.status === filter)

  function resolve(id: number) {
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d)))
    addAuditEntry('resolve_dispute', String(id))
  }

  function dismiss(id: number) {
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'dismissed' } : d)))
    addAuditEntry('dismiss_dispute', String(id))
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['all', 'open', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize ${
              filter === f ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No disputes found.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {displayed.map((d) => (
            <div key={d.id} className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    Dispute #{d.id} — Waste #{d.wastId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reporter: {d.reporter} · {formatDate(d.createdAt)}
                  </p>
                  <p className="text-sm mt-1">{d.description}</p>
                </div>
                <Badge
                  variant={d.status === 'open' ? 'default' : 'outline'}
                  className="shrink-0"
                >
                  {d.status}
                </Badge>
              </div>
              {d.status === 'open' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolve(d.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Resolve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dismiss(d.id)}>
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Wastes tab ────────────────────────────────────────────────────────────────

function WastesTab() {
  const [wasteId, setWasteId] = useState('')
  const [searched, setSearched] = useState<bigint | null>(null)
  const { config } = useContract()

  const { data: waste, isLoading } = useQuery({
    queryKey: ['admin-waste', searched?.toString()],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getWaste(searched!)
    },
    enabled: searched !== null,
  })

  const handleDeactivate = async () => {
    if (!waste) return
    addAuditEntry('deactivate_waste', waste.waste_id.toString())
    alert(`Deactivate waste #${waste.waste_id} — connect admin wallet to confirm.`)
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = wasteId.trim()
          if (trimmed) setSearched(BigInt(trimmed))
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            min="1"
            placeholder="Waste ID…"
            value={wasteId}
            onChange={(e) => setWasteId(e.target.value)}
            className="pl-9"
            aria-label="Waste ID"
          />
        </div>
        <Button type="submit" disabled={!wasteId.trim()}>
          Lookup
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {waste && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Waste #{waste.waste_id.toString()}</CardTitle>
            <Badge variant={waste.is_active ? 'default' : 'outline'}>
              {waste.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Type: {wasteTypeLabel(waste.waste_type)}</p>
            <p>Owner: {formatAddress(waste.current_owner)}</p>
            <p>Registered: {formatDate(waste.recycled_timestamp)}</p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleDeactivate()}
                disabled={!waste.is_active}
                aria-label="Deactivate waste"
              >
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                Deactivate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {searched !== null && !isLoading && !waste && (
        <p className="text-sm text-muted-foreground">No waste found with ID #{searched.toString()}.</p>
      )}
    </div>
  )
}

// ── Incentives tab ────────────────────────────────────────────────────────────

function IncentivesTab() {
  const { data: incentives = [], isLoading } = useAdminIncentives()
  const [filter, setFilter] = useState('')

  const filtered = incentives.filter(
    (inc) =>
      !filter ||
      inc.rewarder.toLowerCase().includes(filter.toLowerCase()) ||
      wasteTypeLabel(inc.waste_type).toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter by rewarder or type…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filter incentives"
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No incentives found.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {filtered.map((inc) => (
            <div key={inc.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {wasteTypeLabel(inc.waste_type)}{' '}
                  <span className="text-muted-foreground">#{inc.id}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatAddress(inc.rewarder)} · {inc.reward_points} pts · Budget:{' '}
                  {inc.remaining_budget}/{inc.total_budget}
                </p>
              </div>
              <Badge variant={inc.active ? 'default' : 'outline'}>
                {inc.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── System Health tab ─────────────────────────────────────────────────────────

const HEALTH_METRICS = [
  { label: 'RPC Node', icon: <Wifi className="h-4 w-4" />, status: 'healthy', latency: '42ms' },
  { label: 'Contract', icon: <Cpu className="h-4 w-4" />, status: 'healthy', latency: '—' },
  { label: 'Firebase DB', icon: <Database className="h-4 w-4" />, status: 'healthy', latency: '18ms' },
  { label: 'Indexer', icon: <Activity className="h-4 w-4" />, status: 'degraded', latency: '320ms' },
]

function SystemHealthTab() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {HEALTH_METRICS.map(({ label, icon, status, latency }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between pt-4 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{icon}</span>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">Latency: {latency}</p>
                </div>
              </div>
              <span
                className={`flex h-2.5 w-2.5 rounded-full ${
                  status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Uptime (last 7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-0.5">
            {Array.from({ length: 28 }).map((_, i) => (
              <div
                key={i}
                className={`h-6 flex-1 rounded-sm ${i === 19 ? 'bg-yellow-400' : 'bg-green-500'}`}
                title={i === 19 ? 'Degraded' : 'Healthy'}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">99.6% uptime</p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Config tab ────────────────────────────────────────────────────────────────

function ConfigTab() {
  const [collectorPct, setCollectorPct] = useState('50')
  const [ownerPct, setOwnerPct] = useState('50')

  const total = Number(collectorPct) + Number(ownerPct)
  const isValid = total === 100

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reward Split Percentages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Collector %</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={collectorPct}
                onChange={(e) => setCollectorPct(e.target.value)}
                aria-label="Collector percentage"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Owner %</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={ownerPct}
                onChange={(e) => setOwnerPct(e.target.value)}
                aria-label="Owner percentage"
              />
            </div>
          </div>
          {!isValid && (
            <p className="text-xs text-destructive">Percentages must sum to 100 (currently {total}).</p>
          )}
          <Button disabled={!isValid} aria-label="Save configuration">
            Save Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Audit log tab ─────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [log] = useState<AuditEntry[]>([..._auditLog])

  return (
    <div className="space-y-2">
      {log.length === 0 ? (
        <p className="text-sm text-muted-foreground">No admin actions recorded this session.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {log.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{entry.action}</p>
                <p className="text-xs text-muted-foreground">Target: {entry.target}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(entry.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  useAppTitle('Admin Dashboard')
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const isAdmin = user?.role === 'Admin'

  // Filter tabs based on permissions
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin)

  return (
    <div className="space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-destructive" />
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">System management and oversight.</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Some sections are restricted to admin accounts only.
        </div>
      )}

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'disputes' && <DisputesTab />}
        {activeTab === 'wastes' && <WastesTab />}
        {activeTab === 'incentives' && <IncentivesTab />}
        {activeTab === 'health' && <SystemHealthTab />}
        {activeTab === 'config' && isAdmin && <ConfigTab />}
        {activeTab === 'audit' && <AuditLogTab />}
      </div>
    </div>
  )
}

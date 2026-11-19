export const lines = ['Delegate', 'Investigate', 'Operate'] as const;
type Station = { path: string; room: string; task: string; line: typeof lines[number]; aliases: string };
export const stations: Station[] = [
  { path: '/runs', room: 'Runs', task: 'Start a run or approve a write', line: 'Delegate', aliases: 'approval permission review tool' },
  { path: '/agents', room: 'ARONA', task: 'Ask the squad', line: 'Delegate', aliases: 'chat agent committee relay' },
  { path: '/missions', room: 'Missions', task: 'Track open actions', line: 'Delegate', aliases: 'goals tasks owners' },
  { path: '/skills', room: 'Craft', task: 'Build a reusable skill', line: 'Delegate', aliases: 'compose skills' },
  { path: '/inbox', room: 'Inbox', task: 'Triage incoming messages', line: 'Delegate', aliases: 'notifications' },
  { path: '/dream', room: 'Dream', task: 'Review overnight findings', line: 'Investigate', aliases: 'nightwatch recommendations' },
  { path: '/memory', room: 'Cortex', task: 'Find a memory note', line: 'Investigate', aliases: 'vault sources stale' },
  { path: '/documents', room: 'Archive', task: 'Read a filed document', line: 'Investigate', aliases: 'docs files' },
  { path: '/graphs', room: 'Map', task: 'Explore project connections', line: 'Investigate', aliases: 'graph knowledge' },
  { path: '/activity', room: 'Log', task: 'Inspect recent activity', line: 'Investigate', aliases: 'audit history' },
  { path: '/', room: 'Lobby', task: 'Check the workspace overview', line: 'Operate', aliases: 'home dashboard spend budget' },
  { path: '/business', room: 'Ledger', task: 'Review business finances', line: 'Operate', aliases: 'revenue finance' },
  { path: '/automations', room: 'Patrol', task: 'Manage scheduled jobs', line: 'Operate', aliases: 'automations cron' },
  { path: '/calendar', room: 'Calendar', task: 'Check upcoming handshakes', line: 'Operate', aliases: 'events appointments' },
  { path: '/integrations', room: 'Links', task: 'Connect an integration', line: 'Operate', aliases: 'sync services' },
  { path: '/settings', room: 'Settings', task: 'Configure the operator', line: 'Operate', aliases: 'model token preferences' },
  { path: '/setup', room: 'Briefing', task: 'Set up the workspace', line: 'Operate', aliases: 'setup wizard onboarding' },
];
export function matchStations(query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/);
  return stations.filter(s => terms.every(t => `${s.room} ${s.task} ${s.line} ${s.aliases} ${s.path}`.toLowerCase().includes(t)));
}

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Box,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FilePlus2,
  FileText,
  History,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Map,
  Megaphone,
  Radio,
  ShieldCheck,
  Siren,
  Users,
  Waves,
} from 'lucide-react';
import i18n from '../i18n';
import { ROLES } from './constants';

export const ROLE_NAV_ITEMS = {
  [ROLES.CITIZEN]: [
    { labelKey: 'nav.overview', label: 'Overview', to: '/dashboard/citizen', icon: LayoutDashboard, end: true },
    { labelKey: 'nav.home', label: 'FloodConnect Home', to: '/home', icon: Home },
    { labelKey: 'nav.liveMap', label: 'Flood Map', to: '/dashboard/citizen/map', icon: Map },
    { labelKey: 'nav.basin3d', label: '3D Flood Basin', to: '/3d-basin', icon: Box },
    { labelKey: 'nav.aiAssistant', label: 'AI & Live Voice', to: '/assistant', icon: Bot },
    { labelKey: 'nav.reportFlood', label: 'Report Flood Incident', to: '/dashboard/citizen/report', icon: FilePlus2 },
    { labelKey: 'nav.requestHelp', label: 'Request Emergency Help', to: '/dashboard/citizen/emergency', icon: Siren },
    { labelKey: 'nav.myReportsRequests', label: 'My Reports & Requests', to: '/dashboard/citizen/submissions', icon: FileText },
    { labelKey: 'nav.alertsShelters', label: 'Alerts, Official Info & Shelters', to: '/dashboard/citizen/alerts-shelters', icon: Building2 },
    { labelKey: 'nav.notifications', label: 'Notification Centre', to: '/notifications', icon: Bell },
  ],
  [ROLES.VOLUNTEER]: [
    { labelKey: 'nav.overview', label: 'Overview', to: '/dashboard/volunteer', icon: LayoutDashboard, end: true },
    { labelKey: 'nav.assignedTasks', label: 'Assigned Tasks', to: '/dashboard/volunteer/tasks', icon: ClipboardList },
    { labelKey: 'nav.fieldObservations', label: 'Field Support', to: '/dashboard/volunteer/field-support', icon: Compass },
    { labelKey: 'nav.shelterStatus', label: 'Relief Shelters', to: '/dashboard/volunteer/shelters', icon: Building2 },
    { labelKey: 'nav.basin3d', label: '3D Flood Basin', to: '/3d-basin', icon: Box },
    { labelKey: 'nav.aiAssistant', label: 'AI & Live Voice', to: '/assistant', icon: Bot },
    { labelKey: 'nav.notifications', label: 'Notification Centre', to: '/notifications', icon: Bell },
  ],
  [ROLES.RESCUE_TEAM]: [
    { labelKey: 'nav.overview', label: 'Overview', to: '/dashboard/rescue', icon: LayoutDashboard, end: true },
    { labelKey: 'nav.assignedRescues', label: 'Assigned Rescues', to: '/dashboard/rescue/assignments', icon: LifeBuoy },
    { labelKey: 'nav.teamReadiness', label: 'Unit Readiness', to: '/dashboard/rescue/readiness', icon: Radio },
    { labelKey: 'nav.assignmentHistory', label: 'Status Log', to: '/dashboard/rescue/history', icon: History },
    { labelKey: 'nav.basin3d', label: '3D Flood Basin', to: '/3d-basin', icon: Box },
    { labelKey: 'nav.aiAssistant', label: 'AI & Live Voice', to: '/assistant', icon: Bot },
    { labelKey: 'nav.notifications', label: 'Notification Centre', to: '/notifications', icon: Bell },
  ],
  [ROLES.ADMIN]: [
    { labelKey: 'nav.overview', label: 'Overview', to: '/dashboard/admin', icon: LayoutDashboard, end: true },
    { labelKey: 'nav.analytics', label: 'Analytics', to: '/dashboard/admin/analytics', icon: BarChart3 },
    { labelKey: 'nav.incidents', label: 'Incident Verification', to: '/dashboard/admin/incidents', icon: ClipboardCheck },
    { labelKey: 'nav.emergencyRequests', label: 'Emergency Dispatch', to: '/dashboard/admin/emergencies', icon: Siren },
    { labelKey: 'nav.rescueTeams', label: 'Rescue Teams', to: '/dashboard/admin/rescue-teams', icon: LifeBuoy },
    { labelKey: 'nav.volunteers', label: 'Volunteer Approvals', to: '/dashboard/admin/volunteers', icon: ShieldCheck },
    { labelKey: 'nav.alerts', label: 'Official Alerts', to: '/dashboard/admin/alerts', icon: Megaphone },
    { labelKey: 'nav.officialUpdates', label: 'Official Info (Hydro/Weather)', to: '/dashboard/admin/official-info', icon: Waves },
    { labelKey: 'nav.shelters', label: 'Shelters', to: '/dashboard/admin/shelters', icon: Building2 },
    { labelKey: 'nav.basin3d', label: '3D Flood Basin', to: '/3d-basin', icon: Box },
    { labelKey: 'nav.aiAssistant', label: 'AI & Live Voice', to: '/assistant', icon: Bot },
    { labelKey: 'nav.usersRoles', label: 'Users & Roles', to: '/dashboard/admin/users', icon: Users },
    { labelKey: 'nav.auditLog', label: 'Audit History', to: '/dashboard/admin/audit', icon: AlertTriangle },
    { labelKey: 'nav.notifications', label: 'Notification Centre', to: '/notifications', icon: Bell },
  ],
};

export function getNavItemsForRole(role) {
  const items = ROLE_NAV_ITEMS[role] || ROLE_NAV_ITEMS[ROLES.CITIZEN];
  return items.map((item) => ({
    ...item,
    label: i18n.t(item.labelKey, { defaultValue: item.label }),
  }));
}

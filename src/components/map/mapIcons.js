import L from 'leaflet';

const SEVERITY_COLORS = {
  critical: '#DC2626',
  high: '#F28C28',
  medium: '#D97706',
  low: '#13A89E',
};

export function createIncidentMarkerIcon({ severity = 'medium', status = 'verified' }) {
  const fill = SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium;
  const isVerified = status === 'verified';
  const stroke = isVerified ? '#0B2545' : '#475569';
  const dashAttr = isVerified ? '' : 'stroke-dasharray="3 2"';
  const innerFill = isVerified ? '#FFFFFF' : '#FEF5EC';

  const html = `
    <div style="position:relative;width:30px;height:36px;display:flex;align-items:center;justify-content:center;">
      <svg width="30" height="36" viewBox="0 0 30 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 2C8.373 2 3 7.373 3 14C3 22.2 15 34 15 34C15 34 27 22.2 27 14C27 7.373 21.627 2 15 2Z"
          fill="${fill}" stroke="${stroke}" stroke-width="2" ${dashAttr} />
        <circle cx="15" cy="13.5" r="5" fill="${innerFill}" />
        ${
          isVerified
            ? `<path d="M12.7 13.6L14.3 15.2L17.6 11.9" stroke="#0B2545" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
            : `<circle cx="15" cy="13.5" r="2.2" fill="${fill}" />`
        }
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'floodconnect-incident-marker',
    html,
    iconSize: [30, 36],
    iconAnchor: [15, 34],
    popupAnchor: [0, -32],
  });
}

export function createShelterMarkerIcon(status = 'open') {
  const bg = status === 'full' || status === 'closed' ? '#475569' : '#0B2545';
  const accent = status === 'open' ? '#13A89E' : status === 'near_capacity' ? '#F28C28' : '#CBD5E1';

  const html = `
    <div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="26" height="26" rx="6" fill="${bg}" stroke="${accent}" stroke-width="2.2"/>
        <path d="M8 14.5L15 8.5L22 14.5V21.5H17.5V16.5H12.5V21.5H8V14.5Z" fill="#FFFFFF"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'floodconnect-shelter-marker',
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

export function createLocationPickerIcon() {
  const html = `
    <div style="width:32px;height:38px;display:flex;align-items:center;justify-content:center;">
      <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2C8.82 2 3 7.82 3 15C3 24 16 36 16 36C16 36 29 24 29 15C29 7.82 23.18 2 16 2Z"
          fill="#0B2545" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="16" cy="14.5" r="5" fill="#13A89E"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'floodconnect-picker-marker',
    html,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
  });
}

export function createRescueDispatchMarkerIcon(priority = 'high', isSelected = false) {
  const fill = SEVERITY_COLORS[priority] || SEVERITY_COLORS.high;
  const stroke = isSelected ? '#0B2545' : '#FFFFFF';
  const strokeWidth = isSelected ? '3' : '2';

  const html = `
    <div style="width:34px;height:40px;display:flex;align-items:center;justify-content:center;">
      <svg width="34" height="40" viewBox="0 0 34 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 2C9.268 2 3 8.268 3 16C3 25.5 17 38 17 38C17 38 31 25.5 31 16C31 8.268 24.732 2 17 2Z"
          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
        <circle cx="17" cy="15.5" r="6" fill="#FFFFFF"/>
        <path d="M17 12.2V18.8M13.7 15.5H20.3" stroke="${fill}" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'floodconnect-rescue-marker',
    html,
    iconSize: [34, 40],
    iconAnchor: [17, 38],
    popupAnchor: [0, -34],
  });
}


export const card = { border: 'none', borderRadius: 14, padding: 20, margin: '16px 0', background: '#fff', color: '#1f2a44', boxShadow: '0 2px 10px rgba(31,42,68,0.08)' };
export const input = { padding: 10, margin: '4px 6px 8px 0' };
export const btn = { padding: '9px 16px', background: '#0d9488', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', marginRight: 6, fontWeight: 600 };
export const btnRed = { ...btn, background: '#dc2626' };
export const errText = (e) => e.response?.data?.message || 'Something went wrong';